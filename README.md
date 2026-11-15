# Shared PostgreSQL Database

The `sprint2-database` branch contains the shared development persistence layer
for Norms Gold Pan: PostgreSQL models, Prisma data access, SQL migrations,
synthetic seed data, database tests, and UML diagrams.

## Technology

- PostgreSQL 18.1
- Prisma ORM 7.10.1 with the PostgreSQL adapter and `pg`
- Node.js 24, TypeScript, and Zod validation
- Python 3.9+ for the optional local-cluster helper and UML checks

Use the Node version in `.nvmrc` and install the committed dependency versions
with `npm ci`.

## Database models

| Model | Purpose |
| --- | --- |
| User | Account identity, normalized unique email, external authentication reference, and role |
| StudentProfile | Student information and owned photo/resume references |
| ProfessorProfile | Faculty information, research interests, contact fields, and owned photo reference |
| FileAsset | Private file metadata and ownership; file bytes are stored separately |
| Opportunity | Research-post details, owner, draft/publication status, hours, and deadline |
| ResearchArea / OpportunityResearchArea | Research taxonomy and many-to-many post associations |
| Application | Student/post association, submitted resume reference, decision, and denial reason |
| Conversation / Message | Student–professor conversation pairs and persistent message history |

Foreign keys, uniqueness constraints, checks, and triggers enforce ownership,
valid roles, file metadata, publication requirements, application decisions,
message participants, and optimistic profile versions.

## Set up a new local development database

Install Node 24, npm, Python 3.9+, and PostgreSQL 18.1 binaries first.

```bash
git clone --branch sprint2-database https://github.com/npant1/3155implementation.git
cd 3155implementation
npm ci
python3 scripts/local-postgres.py
npm run db:generate
npm run db:init
npm run db:seed
npm run db:verify
```

The helper creates an isolated cluster under ignored `.dev/postgres`, listens
on `127.0.0.1:55432`, creates `campus_dev` and `campus_test`, and writes generated
local credentials to ignored `.env`. On macOS it can locate Postgres.app;
otherwise place PostgreSQL binaries on PATH or pass
`--bin /path/to/postgresql/bin`.

**Do not create `.env` before running this helper.** It refuses to overwrite
existing configuration or an unowned cluster. If you already have a local
development database, skip the helper, copy `.env.example` to `.env`, and set
`DATABASE_URL` and `TEST_DATABASE_URL` yourself. See the
[detailed setup instructions](docs/DATABASE.md).

Stop the helper-managed cluster with:

```bash
python3 scripts/local-postgres.py --stop
```

Restart it with the original helper command. Stopping does not delete data.

## Commands

| Command | Behavior |
| --- | --- |
| `npm run db:generate` | Generate the typed Prisma client from the schema |
| `npm run db:init` | Apply the four committed migrations; does not reset or seed the database |
| `npm run db:seed` | Create missing synthetic development records without overwriting existing records |
| `npm run db:verify` | Connect through Prisma, verify transactional write/read/delete, and run a listing query |
| `npm run db:status` | Compare this branch's migration history with the configured database |
| `npm run db:validate` | Validate the Prisma schema |

The seed includes fictional student/professor records, a published opportunity,
a draft, an application, a conversation, and a message. It contains no real
user information. A sample deadline is set when the post is first created;
rerunning the seed does not extend it.

## Tests

```bash
npm run lint
npm run typecheck
npm test
npm run test:db
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_uml.py' -v
```

Integration tests apply migrations to `TEST_DATABASE_URL`, create random
test-owned records, and clean up those records only. They do not truncate
shared tables or reset development data. The GitHub Actions workflow uses
an ephemeral PostgreSQL service.

## Team configuration and limits

- Use local development databases only. The supplied tools reject production
  mode, remote hosts, and database names without a `_dev` or `_test` suffix.
  Integration tests additionally require a `_test` database.
- Keep `.env`, credentials, local database files, generated clients, and
  dependencies out of Git. `.env.example` contains placeholders only.
- Each member should use their own development/test databases. Use separate
  databases when switching between feature branches with different migrations.
- Pull the committed schema, migrations, and lockfile together. Run `npm ci`,
  `npm run db:generate`, and `npm run db:init` after database changes.
- Create a new reviewed migration for schema changes; do not edit applied
  migrations. SQL checks/triggers are part of the schema and must be retained.
- Data-access functions are trusted server code. They do not authenticate a
  caller, provide HTTP endpoints, or implement production row-level security.
- FileAsset stores metadata, not uploaded file contents. Authentication, object
  storage, production deployment, and interface integration are separate work.

[Full database guide](docs/DATABASE.md) ·
[Prisma schema](prisma/schema.prisma) ·
[Migration SQL](prisma/migrations) · [UML diagrams](docs/uml/README.md)
