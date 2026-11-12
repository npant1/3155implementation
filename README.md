
### ITSC 3155 - Software Engineering Implementation

## Project Overview

Norms Gold Pan is a web application designed to connect college students with professors offering undergraduate research opportunities. Students can discover research opportunities, view information about projects, and interact with faculty.


## Implemented Feature

### Student Login

The implemented Sprint 1 feature is the Student Login page. This feature allows students to enter their username and password, receive an error message when credentials are incorrect, and access the student portal when valid credentials are provided.

The login interface was designed to follow the team's approved Figma prototype.

### User Story

**GitHub Issue #1: Student Login**

> As a user, I can login into the student portal.

**Acceptance Criteria:**

- The login interface must be easy to navigate.
- Users must be able to enter a username and password.
- Invalid credentials must produce an error message.
- Valid credentials must redirect the user to the student portal.

**Implementation Tasks:**

- Create the student login button.
- Create username and password input fields.
- Implement credential validation.
- Redirect users to the student portal after successful login.

[View GitHub Issue #1](https://github.com/npant1/3155implementation/issues/1)

## Figma Design

The student login interface was implemented using the team's original Figma prototype as a visual reference.

The design includes username and password fields, a Student Login button, and separate navigation options for professor login and account registration.

[View Student Login Figma Design](https://www.figma.com/proto/d0P8tCCwxmCInTN8C4LEjg/Main?node-id=1-2&t=4esNemZXWSrhdoKD-0&scaling=scale-down&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=1%3A2)

## Technologies Used

- HTML5, CSS3, and JavaScript for the student interface
- Python 3.12, FastAPI, and SQLAlchemy for the backend and persistence layer
- MySQL for team development and deployment
- Alembic for reviewed, version-controlled schema migrations
- Git and GitHub for version control
- Figma for UI/UX design

## Installation and Setup

### Prerequisites

- Git
- A modern web browser
- Python 3.12
- MySQL 8 or a compatible MySQL server

### Step 1: Clone and enter the repository

```bash
git clone https://github.com/npant1/3155implementation.git
cd 3155implementation
```

### Step 2: Create a virtual environment and install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

### Step 3: Configure MySQL and environment variables

Copy `.env.example` to `.env`. Replace the database URL with the local MySQL database and user created for this project, and generate a unique signing key:

```bash
cp .env.example .env
openssl rand -hex 32
```

Paste the generated value into `SECRET_KEY`. Do not commit `.env` or share real credentials. Use a local development database and a least-privilege database user; do not point this prototype at production.

### Step 4: Create the schema and sample listings

```bash
alembic upgrade head
python -m backend.app.seed
```

### Step 5: Run the application

```bash
uvicorn backend.app.main:app --reload
```

Open <http://127.0.0.1:8000>. The FastAPI app serves both the browser interface and `/api` endpoints.

## Sprint 2 Persistence

The approved relational model is implemented with SQLAlchemy and MySQL. `User` and role-specific profiles hold account and profile data. `Opportunity`, its research areas and ordered detail items hold postings. `Application` belongs to one student profile and one opportunity, with a unique student/opportunity constraint. Conversation, participant, and message models prepare persistence for the messaging backlog. Resume and photo fields hold private object-storage keys only; file upload and object storage are not implemented.

The student application story is GitHub [#3 - Apply to Research Opportunity Student](https://github.com/npant1/3155implementation/issues/3). Students register locally or sign in, open a listing, and submit an interest statement. The API takes the applicant identity from an HttpOnly, SameSite session cookie, not from editable form data. Passwords are Argon2-hashed. Applications are persisted as `submitted`; duplicate applications, non-student accounts, unpublished opportunities, and expired opportunities are rejected. Email verification, password reset, rate limiting, professor login, and applicant review actions are not part of this prototype.

### UML diagrams

- [Relational domain model (SVG)](./docs/uml/domain-model.svg) and [PlantUML source](./docs/uml/domain-model.puml)
- [Apply sequence (SVG)](./docs/uml/apply-sequence.svg) and [PlantUML source](./docs/uml/apply-sequence.puml)

The class diagram covers the persisted entities and relationships. The sequence diagram follows an authenticated student from opportunity view through validation and application persistence.

### Database and team workflow

- Each team member installs the same dependencies with `python -m pip install -r requirements.txt`, creates a personal `.env` from `.env.example`, and uses a separate local MySQL database. Never put passwords or signing keys in source, screenshots, issue comments, or shared documentation.
- `DATABASE_URL` follows `mysql+pymysql://USER:PASSWORD@HOST:3306/DATABASE`. URL-encode special characters in credentials. Each member creates the database and a local user with only the permissions needed for development.
- Apply committed migrations with `alembic upgrade head`. When a model changes, generate a migration with `alembic revision --autogenerate -m "describe change"`, review the generated migration, and commit it with the model change. Do not edit an already-applied migration; add a follow-up migration instead.
- Seed the six sample listings with `python -m backend.app.seed`. Seeding is repeatable and does not set a reusable demo password.
- Run automated tests with `python -m pytest`. Tests use an isolated in-memory SQLite database and do not connect to a configured MySQL server.
- For deployed HTTPS, set `COOKIE_SECURE=true` and provide deployment-managed database/signing secrets. The local-account implementation is a teaching prototype, not a production authentication service.

### Assumptions and requirements to review

- Figma MCP tools were not available in this session, and the linked Figma prototype displayed a sign-in wall. The diagrams and interface were therefore based on source code and GitHub story descriptions, not a verified frame inspection.
- Issue #3 provides no policy for application text, edits, withdrawal, or attachments. The implementation stores one interest statement and allows one application per student/opportunity; revisions and withdrawal are not supported.
- Issue #6 calls for responsibilities, goals, prerequisites, and duration. The model supports these fields, but the sample listings do not invent values where the backlog/source provides none.
- Local accounts have no verification or recovery flow. Confirm account lifecycle and institutional identity requirements before production use.
- Messaging requires exactly one student and one professor per conversation in the proposed model. Confirm whether group conversations or conversations across multiple opportunities are needed before implementing the messaging story.
- Resume/photo object-storage provider, file limits, retention, and access policies remain undecided.
- A live MySQL server was not available in this environment. Automated persistence tests and migration upgrade use isolated SQLite, and the migration was separately compiled to MySQL SQL without connecting. Team members must validate against the chosen MySQL version before deployment.

## Feature Demonstration

### Student Login Process

1. Open the application and choose **Create account** or **Sign in**.
2. Registration requires a full name, major, email, and a password of at least 12 characters.
3. Signed-in students can apply from an opportunity page; the submission is stored in the configured database.
4. Choose **Sign out** to clear the session cookie.

## Testing

The account and opportunity application flows can be tested against the Sprint 2 acceptance criteria.

| Acceptance Criteria | Test Procedure | Expected Result |
|---|---|---|
| Account validation | Submit an invalid email or too-short registration password | The API rejects invalid input |
| Application authentication | Submit an application while signed out | The API returns an authentication error |
| Application persistence | Register, submit an application, then request `/api/applications/mine` | The submitted application is returned for the signed-in student |
| Duplicate submission | Submit again to the same opportunity | The API returns a conflict |
| Logout functionality | Sign in and click **Sign out** | The session cookie is cleared and protected routes reject the user |
| Opportunity eligibility | Apply to a closed or expired opportunity | The API rejects the application |

The automated API and persistence tests run with `python -m pytest`; MySQL integration remains a team validation step.

## Sprint Planning

GitHub Issues are used to track user stories, acceptance criteria, and implementation tasks.

**Sprint 1 Story:** Student Login

**GitHub Issue:** [#1 - Student Login](https://github.com/npant1/3155implementation/issues/1)

**Sprint 2 Persistent Story:** Apply to a Research Opportunity

**GitHub Issue:** [#3 - Apply to Research Opportunity Student](https://github.com/npant1/3155implementation/issues/3)

## Version Control

GitHub is used to manage the project source code and track implementation changes.

**Repository:** [3155implementation](https://github.com/npant1/3155implementation)

Use the team's current feature branch and pull-request review process when integrating sprint work.

## AI-Assisted Development

AI-assisted development tools can support the implementation process.

**GitHub Copilot**

GitHub Copilot can assist with generating code suggestions, improving JavaScript logic, identifying potential errors, and reviewing code.

**Figma MCP**

Figma MCP can provide design context from the Figma prototype to support implementation of interface elements, layouts, and styling.


## Current Limitations

- The local account system is suitable only for this prototype; it has no email verification, password reset, login throttling, or production identity-provider integration.
- Professor account registration, professor posting/application-review endpoints, messaging, and resume/photo upload are not implemented.
- Resume and profile-photo object keys are modeled but require a private file-storage service before use.
- The database and sample listings are persistent only after the team configures MySQL, applies migrations, and runs the seed command.


## Project Deliverables

- Student account and application persistence
- SQLAlchemy domain models and Alembic migration
- PlantUML class and application-sequence diagrams with SVG renders
- API and persistence tests
- Original user story and acceptance criteria
- Figma design reference (visual inspection pending)
- GitHub Sprint 1 issue
- Manual testing procedures
- Git commit history
- README documentation
- Pull request and merge into the main branch

## Research Listings

Students can search and sort research listings, open an opportunity to view its faculty contact and details, and return to the listings at any time. Signed-in students can submit an application. The backend validates and stores the application; sample listings are loaded from the database.

The research listings prototype displays six sample research opportunities. Students can search by project title, description, faculty, department, or research area, and sort by newest posting, title, or application deadline.

Use the FastAPI run instructions above to serve the listings and API on the same origin.

[View the Research Listings Figma frame](https://www.figma.com/proto/d0P8tCCwxmCInTN8C4LEjg/Main?node-id=6-5&t=RjfB5uCHilmrC0Kn-0&scaling=scale-down&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=1%3A2)
