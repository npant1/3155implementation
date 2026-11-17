# Shared PostgreSQL development database

The `sprint2-database` branch supplies the **whole project's** persistence
foundation. The standalone messaging page uses this shared foundation for user identities,
contacts and conversations. This branch includes only messaging UI/API code;
profile editors and other application pages remain separate features.

## Stack and scope

- PostgreSQL 18.1, Prisma ORM 7.10.1, the Prisma PostgreSQL adapter and `pg`.
- Node.js 24 LTS, TypeScript, Zod validation, ESLint, Node's test runner.
- Prisma models, committed SQL migrations, a server-only data-access module,
  repeatable synthetic seed data, integration tests, UML, and a CI workflow.
- No production authentication, file-byte storage or production credentials
  are included. The messaging API and page are documented in [MESSAGING.md](MESSAGING.md).

The application reference is [the team repository](https://github.com/npant1/3155implementation).
The existing stack was static HTML/CSS/JavaScript; Node/TypeScript is added
for persistence tooling and a reusable future server layer, without converting
the frontend to another framework. Prisma was chosen for typed PostgreSQL
queries and versioned migrations. See [Prisma's PostgreSQL documentation](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql).

## Local setup: isolated cluster

Prerequisites: Git, Python 3.9+, Node.js 24 (see `.nvmrc`), npm, and PostgreSQL
18.1 binaries. Node is required only for the data layer, not the static pages.
A lockfile is committed; use `npm ci`, not a fresh dependency upgrade.

```bash
git clone https://github.com/npant1/3155implementation.git
cd 3155implementation
git switch sprint2-database
npm ci
python3 scripts/local-postgres.py
npm run db:generate
npm run db:init
npm run db:seed
npm run db:verify
```

On macOS, the helper locates PostgreSQL through PATH or Postgres.app. Elsewhere,
pass `--bin /path/to/postgresql/bin`. It initializes its **own** `.dev/postgres`
cluster, binds to `127.0.0.1:55432`, enables password authentication, creates
`campus_dev` and `campus_test`, and writes randomly generated local credentials
to the ignored `.env`. It does not use, reset, or change existing Postgres.app
clusters. It refuses to overwrite an existing `.env` or unowned cluster.
If port 55432 is occupied, stop and resolve the conflict; do not reuse an
unknown server. The private cluster is for local development only; its
initial database role is the cluster owner and must not become a production
application role.

Stop only this project's cluster with:

```bash
python3 scripts/local-postgres.py --stop
```

Restart it using the original helper command. Data survives a stop/restart.
`.dev` and `.env` must never be committed. A runtime was downloaded to a
temporary directory while implementing this branch; teammates should install
Node normally rather than rely on that machine-specific temporary path.

## Alternative: existing local development PostgreSQL

If the team already runs its own local PostgreSQL server, skip the helper.
Using a local database administrator, create a **new** development role and two
empty databases (commands may need `-h`, `-p`, and an administrator `-U`):

```bash
createuser --pwprompt --createdb campus_dev
createdb --owner=campus_dev campus_dev
createdb --owner=campus_dev campus_test
cp .env.example .env
```

Edit `.env` locally with the chosen password, host and port, then run the npm
commands above. `DATABASE_URL` must identify the development database and
`TEST_DATABASE_URL` must identify the **different** test database. URL-encode
special characters in credentials. Never paste a real URL into an issue,
README, browser script, or chat. `.env.example` contains placeholders only.

The supplied tooling refuses `NODE_ENV=production`, remote hosts, database
names that do not end in `_dev` or `_test`, and connection-string host
redirects. Integration tests additionally require a `_test` target. These
local-development restrictions are intentional, not a production hosting
recipe. A shared hosted development service requires a separately reviewed
configuration change; do not weaken the guards to reach a production server.

## Data model and issue mapping

| Model | Persistent data / relationships | Backlog evidence |
| --- | --- | --- |
| User | UUID, unique normalized email, optional unique external auth subject, STUDENT/PROFESSOR role, timestamps | [#1 login](https://github.com/npant1/3155implementation/issues/1), role-specific profiles |
| StudentProfile | Owner's userId is PK/FK; name, major, concentration, school year, about, photo/resume references, version | [#7 student profile](https://github.com/npant1/3155implementation/issues/7), Figma 14:114 |
| ProfessorProfile | Owner's userId is PK/FK; name, degree, department, education, research areas, biography, contact/office fields, photo, version | [#4 professor profile](https://github.com/npant1/3155implementation/issues/4), Figma 59:276 |
| FileAsset | Owner, private storage key, filename, media type, size, PHOTO/RESUME purpose | #7 and [#9 applicant resumes](https://github.com/npant1/3155implementation/issues/9) |
| Opportunity | Professor owner, title/description, responsibility/goal/prerequisite lists, duration, hours range, deadline, draft/published/archived status | [#6 post builder](https://github.com/npant1/3155implementation/issues/6), Figma 83:131 |
| ResearchArea / OpportunityResearchArea | Unique area names and explicit many-to-many join | [#2 listings](https://github.com/npant1/3155implementation/issues/2), [#5 search](https://github.com/npant1/3155implementation/issues/5), main's `areas[]` |
| Application | Unique student/opportunity pair, submitted resume snapshot, pending/accepted/declined decision, reason, decider, dates | [#3 apply](https://github.com/npant1/3155implementation/issues/3), #9 |
| Conversation | Unique student/professor pair | [#8 messages](https://github.com/npant1/3155implementation/issues/8), #14/#15 |
| Message | Conversation, participant sender, immutable nonblank body and timestamp | #8 message history |

Each shared profile uses its `userId` as primary key, giving contacts one
stable identity per account. Messaging reads those profiles; it does not
provide profile-editing pages.
No real faculty/student information from Figma is copied into development data.

## Constraints and invariants

SQL migrations enforce foreign keys, normalized/unique account emails,
profile-owner roles, positive versions and exactly-one version increments,
nonblank names/messages, valid profile lists, file sizes/types/purposes,
file ownership, valid hours ranges, published-post completeness, and a
research-area link for every published opportunity. Publishing needs a future
deadline; expired published records may remain visible but no longer accept
applications. Profile role checks and publication-area checks lock the owner
or post to serialize relevant concurrent changes.

- A student can apply once per opportunity, only while it is open/published.
  `apply` snapshots the current optional resume reference inside a transaction.
  Changing the student's profile resume does not change submitted applications.
- A declined application needs a nonblank reason. Accepted/pending records
  cannot retain a denial reason. Only the post's professor can decide a pending
  application; decided applications cannot be silently rewritten.
- Conversation participants are fixed. Messages can only be sent by one of
  them. Existing message history and file metadata cannot be updated in place.
- File references include owner ID in their foreign key. A different user's
  file cannot be attached to a profile or application; referenced objects
  cannot be deleted. File metadata does not contain bytes or a public URL.
- User/profile/post/application/message deletion is generally restricted.
  Post-to-area join rows cascade when that post is deleted. No account-wide
  cascade, production retention policy, or user-delete endpoint is provided.

Validation is repeated in the data-access layer for usable errors. Additional
checks and PostgreSQL triggers are in SQL because Prisma cannot represent
them all. Keep migrations intact; `prisma db push` alone would omit these rules.

## Data-access integration contract

`src/db.ts` creates a PostgreSQL connection pool; `src/data/index.ts` exports
`createDataAccess(db)`. Reuse one client per long-running server process and
disconnect on shutdown. Scripts and tests disconnect when they finish.

```ts
import { createDatabase } from './src/db.js';
import { createDataAccess } from './src/data/index.js';

const db = createDatabase();
const data = createDataAccess(db);
// In a future server handler, derive actorId from a verified session:
const profile = await data.getProfessorProfile(actorId);
// Save full allowlisted text fields with the profile's expectedVersion.
// Do not take actorId or role from a browser request body.
```

Implemented methods cover own-profile creation/read/update, registering and
attaching owned file metadata, draft creation/publication, published/own post
lists, applying/listing applications, applicant lists and decisions, and
conversation creation/send/history. They are reusable server operations,
not new user-facing pages or public endpoints. Owner post lists include
drafts; the public listing method only returns published posts. Queries are
capped at 100; cursor pagination remains future work.

`DataAccessError` uses FORBIDDEN, NOT_FOUND, CONFLICT, and INVALID codes. Zod
rejects malformed input and unexpected fields. Future handlers must map those
errors to suitable responses, avoid returning raw database exceptions, and
preserve unsaved UI input when saving fails. Optimistic profile updates use
an atomic owner/version predicate. Database/storage failures roll back writes.

**Security boundary:** this module is trusted server code, not browser code.
It looks up roles and checks ownership, but cannot authenticate a caller who
supplies an arbitrary UUID. There are no default passwords, login sessions,
public write API, or row-level security policies in this branch. A real auth
service and authenticated HTTP boundary must be integrated before exposing
these operations. Database credentials grant development access to the whole
schema and must never be shipped to a browser.

File registration stores validated metadata only. A future upload service must
verify bytes, ownership, MIME signatures, and malware policy; store files in a
private bucket; and coordinate replacement/cleanup. This branch does not
claim to upload or download physical resumes or images.

## Migrations and consistent team development

```bash
npm ci
npm run db:generate
npm run db:init
npm run db:status
```

`db:init` applies committed migrations using Prisma `migrate deploy`; it does
not reset a database or generate new migrations. Members run it after pulling
schema changes. For an intentional schema change on a disposable development
database, edit `prisma/schema.prisma`, then use:

```bash
npx prisma migrate dev --name describe_change --create-only
# Review generated SQL; add checks/triggers if required.
npx prisma migrate dev
npm run db:generate
python3 scripts/generate-uml.py
```

Migration authoring requires a local role with permission to create a shadow
database. Do not edit already-applied migrations, delete migration history,
accept a reset against shared data, or use production connection strings.
Commit schema, migration SQL, repository validation, tests, UML and lockfile
changes together. New team members replay the same history. The four initial
migrations create tables, add domain rules, correct deferred validation,
and harden lists/concurrency. The messaging branch adds a fifth, additive migration for inbox activity and
duplicate-safe message identifiers; see [MESSAGING.md](MESSAGING.md). No
production database was contacted.

## Synthetic data and verification

`npm run db:seed` creates fictional professor Alex Morgan, student Jamie
Rivera, one published post, one draft, an application, a conversation, and a
message. Emails use `example.test`; auth subjects are clearly development
identifiers. Rerunning the seed creates missing rows and preserves edits.
A sample deadline starts 90 days after the first seed; rerunning does not
silently extend it. No fabricated file metadata points to nonexistent uploads.

`npm run db:verify` connects through the actual Prisma adapter, performs a
transactional create/read/delete of its own temporary records, and runs the
same published-list query available to future application handlers. This verifies database-client connectivity. The messaging API and page use
that same database connection; HTTP/DOM integration is covered by the
messaging tests.

```bash
npm run db:validate
npm run lint
npm run typecheck
npm test
npm run test:db
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_uml.py' -v
```

Integration tests migrate `TEST_DATABASE_URL` and create randomized test-owned
records. Cleanup deletes only those records; it never truncates tables or
resets development data. Tests cover cross-client persistence, optimistic
concurrency, role/owner restrictions, SQL checks and rollback, file ownership,
resume snapshots, duplicate/closed applications, decision rules, and message
history/participant enforcement. The workflow in `.github/workflows/database.yml`
runs against an ephemeral PostgreSQL service, using CI-only synthetic credentials.

## UML and assumptions requiring team review

[Diagram sources, rendered SVGs, and reproduction instructions](uml/README.md).
The class source is generated from the Prisma schema; tests detect drift.
The sequence diagram traces `apply` and distinguishes the future caller from
the implemented data layer. Review the diagram when that workflow changes.

Assumptions: a user has one role; applications require a student profile but a
resume is optional; one conversation per student/professor pair is sufficient;
decisions are final; lists show at most 100 records; file retention/account
deactivation and archive policy are not specified; login/registration remain
owned by their features. Deadlines are stored as UTC instants; the UI must
agree on a timezone when converting Figma's date-only 11:59 PM deadline.
Professor research interests are free-text labels, while opportunity search
areas use a shared taxonomy. Team confirmation is needed before production use.
