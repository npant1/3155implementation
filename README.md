# 3155implementation
something

Need Done : 
1) rest of User Stories/Issues
2) Sprint Board
3) 

## Student home

Open `index.html` to view the student home screen. The hamburger opens the Explore menu, with links to Home, Research Listings, Profile, and Log Out. Profile, research listings, messaging, and logout actions are presented as buttons; their behavior can be connected when the related features are integrated.
# Campus Research Portal

The local project includes a student/professor messaging page and a
Figma-inspired professor applicant-review demo.

## Features

- Find professors or students by name, research topic, department or major.
- Open or start a conversation, send messages in either direction, and view
  saved conversation history.
- Open the **Professor applicant review demo** link from the messaging page
  (or visit `/applicants.html`) to review applicants grouped by research
  listing. The demo supports listing filters, individual profiles, sample
  resume previews, per-listing accept/decline decisions, and denial reasons.

Applicant profiles, resumes, and applications use sample data. Review
decisions are held in page state and reset on refresh; they are not saved to
the database. Authentication and applicant APIs are not connected. The
existing database model supports applications, resumes, and decisions, but
the applicant demo is not wired to those server-side operations.

## Run locally

Requires Node.js 24 and npm. For the messaging database, follow the
[database setup](docs/DATABASE.md); it configures a local-only PostgreSQL
database and sample data.

```sh
npm ci
npm run db:generate
npm run db:init
npm run db:seed
npm start
```

Open **http://127.0.0.1:8000/**. `npm start` builds the applicant page and
starts the messaging server. To preview only the applicant UI without the
messaging database, run `npm run dev`; Vite opens `/applicants.html`.

If port 8000 is occupied, set `PORT=8001` before `npm start` and open
**http://127.0.0.1:8001/**.

## Test

```sh
npm run lint
npm run typecheck
npm test
npm run test:db
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_uml.py' -v
```

The database integration tests require `TEST_DATABASE_URL` to point to a
separate local test database with migrations applied. Never use production
credentials or databases for local development or tests.

[Messaging behavior and acceptance criteria](docs/MESSAGING.md) ·
[Database setup](docs/DATABASE.md) · [UML diagrams](docs/uml/README.md)
