# Professor Profile

Professor-profile feature for [GitHub issue #4](https://github.com/npant1/3155implementation/issues/4).
Professors can view and edit their information, change their picture, and see
their published research opportunities. This README documents the professor
profile feature on the `professor-profile` branch.

## Features

- View name, degree, department, education, research interests, biography,
  contact email, virtual-office link, and office hours.
- Edit text fields with Save and Cancel controls. Saved changes persist in
  PostgreSQL through the Node API and Prisma data-access layer.
- Upload a PNG, JPEG, or WebP profile picture up to **2 MiB**. The server checks
  decoded image content and stores private local bytes with database metadata.
- View only the signed-in sample professor's published research opportunities;
  expand a listing for details. Drafts and other professors' posts are excluded.
- Navigate between professor sign-in, the professor portal, and the profile;
  use the profile menu or log out.

The layout follows the [professor-profile Figma frame](https://www.figma.com/proto/d0P8tCCwxmCInTN8C4LEjg/Main?node-id=59-276),
with editing controls and a published-opportunities section added for the
acceptance criteria.

## Run locally

Requires Node 24, npm, and a local PostgreSQL development database. Python
3.9+ is needed for the optional database helper and UML checks.

```bash
git clone --branch professor-profile https://github.com/npant1/3155implementation.git
cd 3155implementation
npm ci
```

Configure the development database using [database setup](docs/DATABASE.md).
For a fresh setup with PostgreSQL binaries installed, run:

```bash
python3 scripts/local-postgres.py
```

The helper generates local credentials in ignored `.env` and creates the
development/test databases. If `.env` and a development database are already
configured, skip this step; do not start another cluster on the same port.
Do not create `.env` before running the fresh-setup helper.

Then run:

```bash
npm run db:generate
npm run db:init
npm run db:seed
npm start
```

Open **http://127.0.0.1:8000/#/professor-login**, select
**Continue as sample professor**, then **My professor profile**.

The seeded account is the fictional **Professor Alex Morgan**. There is no
professor username/password to enter. Use the Node server for this feature;
a Python static server cannot provide the profile API. If port 8000 is in use,
run `PORT=8002 npm start` and open the same route on port 8002.

## Persistence and validation

Profile text and photo metadata persist in PostgreSQL. Photo bytes are stored
in ignored `.dev/uploads`. Cancel discards unsaved text edits. Invalid input,
failed saves, and stale-version conflicts preserve the form; a conflict offers
an explicit reload action that discards those edits.

Saving uses the expected profile version to prevent silent overwrites. Photo
replacement creates metadata and updates the profile reference atomically;
a failed replacement removes the newly written file. Old photo objects remain
private; automatic retention cleanup is not implemented.

## Development-session limits

The local server selects the sample identity and uses an HttpOnly,
SameSite=Strict cookie. Sessions expire after eight hours or end on logout or
server restart. Profile data remains saved after the session ends.

This is a local demonstration, **not production authentication**. The server
binds to loopback and refuses production mode. Keep database credentials and
uploads out of Git. Production account authentication and shared file storage
require separate integration.

## Tests and documentation

```bash
npm run lint
npm run typecheck
npm test
npm run test:db
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test*uml.py' -v
```

Tests cover saved profile data, validation, version conflicts, owner/role
restrictions, published-post filtering, photo validation and rollback,
edit/cancel/save behavior, logout, and empty states. DOM tests use jsdom;
they are not a real-browser visual inspection.

[Detailed feature and API guide](docs/PROFESSOR_PROFILE.md) ·
[Database setup](docs/DATABASE.md) · [UML diagrams](docs/uml/README.md)
