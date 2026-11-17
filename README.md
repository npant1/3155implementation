# Professor Dashboard and Student Login UI

A responsive React and TypeScript login screen based on the [Figma login design](https://www.figma.com/proto/d0P8tCCwxmCInTN8C4LEjg/Main?node-id=1-2&page-id=0%3A1). It is the starting point for the [Student Login user story (#1)](https://github.com/npant1/3155implementation/issues/1).

## Install

Install [Node.js](https://nodejs.org/) and npm, then install the project dependencies:

```sh
npm install
```

## Run locally

Start the Vite development server:

```sh
npm run dev
```

Open the local URL printed in the terminal.

## Features

The login screen provides username and password fields and separate Professor Login, Student Login, and Sign Up actions. Choosing Professor Login opens the professor dashboard, which follows the approved Figma Professor Home screen and includes dashboard search, a navigation menu, and Profile, View Applicants, Posts, and Log Out shortcuts. Choosing Student Login or Sign Up displays local feedback.

**Authentication and the linked professor sections are not connected.** The required login fields are not checked against an account; Professor Login opens a local demo dashboard. Profile, applicant management, and posts are not implemented yet. Student login and sign-up remain unconnected.

## Test

Run the TypeScript check and production build:

```sh
npm run build
```

To manually smoke-test the current UI:

1. Run `npm run dev` and open the local URL.
2. Try submitting either login action with the fields empty; the browser should require the fields.
3. Enter any username and password, then choose Professor Login; the dashboard should open.
4. Search for dashboard shortcuts, open the navigation menu, and verify its links are available.
5. Choose Log Out; the login screen should return. Student Login and Sign Up should display messages that those features are not connected.

These checks verify the local UI only; they do not verify credentials or backend behavior.

## PostgreSQL persistence foundation

The data model and Prisma repository are separate from the React UI. The application service is ready for a trusted backend caller, but the application API and login/signup flow are not connected: do not pass a student ID from browser-controlled input. Choose and implement an authentication provider before exposing application operations.

Each developer needs Node.js/npm and Docker Desktop with its daemon running:

1. Copy `.env.example` to `.env` and replace the local PostgreSQL password with a private development password. `.env` is ignored by Git; never commit it or use production credentials here.
2. Start the local database with `npm run db:start`.
3. Generate the typed Prisma client and apply the checked-in development migration with `npm run db:migrate`.
4. Run `npm test` and `npm run build`.

Commit schema changes together with their generated `prisma/migrations/` files. Use `npm ci` to install the lockfile-consistent toolchain; do not use `prisma db push` to bypass migration history. Run database integration tests only against a local test database with the migrations applied. Set `TEST_DATABASE_URL` to that database's connection string; the test uses unique fixtures and cleans them up. Never point tests or local migrations at production. The team should review migrations before applying them in shared or production environments.

The generated Prisma client is ignored and can be recreated with `npm run prisma:generate`. Local database data is stored in the Compose `postgres-data` volume; `npm run db:stop` stops the container without deleting that data.
# Student Messaging Page

Standalone messaging feature for students and professors to discuss research
opportunities. This branch contains the messaging page and its supporting
API/database code. Student/professor profile pages and profile-editing APIs
are kept on their separate feature branches.

## Features

- Find professors or students by name, research topic, department or major.
- Open or start a conversation and send messages in either direction.
- View saved conversation history, including older messages.
- Refresh incoming replies and safely retry a failed send.

[Figma messaging design](https://www.figma.com/proto/d0P8tCCwxmCInTN8C4LEjg/Main?node-id=189-288)

## Run locally

Requires Node 24 and a local PostgreSQL development database. Follow
[database setup](docs/DATABASE.md) if you have not configured one yet.

```bash
npm ci
npm run db:generate
npm run db:init
npm run db:seed
npm start
```

Open **http://127.0.0.1:8000/**. The app opens directly to Messages. Choose the
sample student or professor to demonstrate both sides. These are local demo
sessions; production authentication is not configured.

If port 8000 is occupied, run `PORT=8001 npm start` and open
**http://127.0.0.1:8001/** instead.

## Test

```bash
npm run lint
npm run typecheck
npm test
npm run test:db
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_uml.py' -v
```

[Messaging behavior and acceptance criteria](docs/MESSAGING.md) ·
[Database setup](docs/DATABASE.md) · [UML diagrams](docs/uml/README.md)
