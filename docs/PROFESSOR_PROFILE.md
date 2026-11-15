# Professor profile — issue #4

Implemented on `professor-profile`, using the shared PostgreSQL foundation.
This guide covers the professor-profile interface, API and persistence.
Professor data uses the Node API and Prisma rather than browser storage.

## Run the feature

Requires Node 24, Python 3.9+, PostgreSQL 18, and the setup in
[DATABASE.md](DATABASE.md).

```bash
npm ci
python3 scripts/local-postgres.py
npm run db:generate
npm run db:init
npm run db:seed
npm start
```

Open **http://127.0.0.1:8000/#/professor-login** and select
**Continue as sample professor**, then **My professor profile**. You can also
reach professor sign-in from the existing student login page. Use the Node
server for this feature; the Python static server cannot provide its API.
If an existing local development cluster is already configured, use its
ignored `.env` and do not initialize another cluster on the same port.

The synthetic seeded account is Professor Alex Morgan. The sample identity is
selected by the server, never a request-body owner ID. A random HttpOnly,
SameSite=Strict cookie identifies the local demo session; writes require the
same origin. The server binds only to loopback, refuses production mode, and
only serves allowlisted frontend files. `.env`, database files, raw upload
paths, backend source files and `.git` cannot be downloaded through it.
The current profile photo is served through an authenticated API endpoint.

**This is not production authentication.** It is a clearly labeled local
sample-professor session for the course demonstration. A real authentication
provider must replace it before exposing this API publicly. Sessions expire
after eight hours and are cleared by logout or a server restart. Persisted
profile data survives logout and restarts.

## Acceptance criteria and behavior

- **Easy navigation:** Professor Login → professor portal → profile. Back
  returns to the portal. The menu provides portal, profile, published-post
  scrolling, and logout. Direct protected links return to sign-in.
- **Professor description:** photo, name, degree, department, education,
  research interests, biography, contact email, virtual office, and office hours.
- **Posted job listings:** owner ID and PUBLISHED status are filtered in the
  database before the query limit. Other professors' posts and drafts are not
  shown. Details expand inline. No posts produces a useful empty state.
- **Editing:** edit and save all text fields with server validation. Cancel
  discards unsaved edits. Saving waits for the PostgreSQL transaction to commit.
  Validation/storage failures preserve the form. Conflicting saves return 409,
  preserve edits, and offer an explicitly labeled reload/discard action.
- **Photo:** select a nonempty PNG, JPEG, or WebP up to 2 MiB. The server
  verifies actual decoded image format and pixel limits, writes private local
  bytes, and atomically creates FileAsset metadata and updates the profile's
  version/reference. Failed/stale updates remove the new file. Downloads
  require a valid session and must refer to the current profile photo.

The default photo and menu are local Figma exports from professor frame
[59:276](https://www.figma.com/proto/d0P8tCCwxmCInTN8C4LEjg/Main?node-id=59-276).
The avatar's fallback is a design reference image; names and text come from
synthetic development records. The reference's green header, gray background,
photo/degree row, About Me and Contact sections are retained. Editing controls,
field structure, and a published-list section extend the reference to satisfy
[issue #4](https://github.com/npant1/3155implementation/issues/4).

## API and persistence boundaries

`professor.js` owns rendering and calls the API; `src/professor-server.ts`
handles session checks, HTTP validation, safe DTOs, and private local photo
files; `src/data/index.ts` handles role/owner checks and transactional data
access; Prisma and committed migrations define the shared PostgreSQL schema.
No schema migration was needed for this feature.

| Endpoint | Behavior |
| --- | --- |
| POST /api/dev-professor-session | Local sample-session entry; requires exact empty JSON object |
| GET /api/professor/profile | Own profile plus own published posts |
| PATCH /api/professor/profile | Strict text fields and expectedVersion; owner comes from server session |
| POST /api/professor/photo | Binary image body, Content-Type, encoded X-File-Name, X-Profile-Version |
| GET /api/professor/photo/:id | Current owned photo bytes, no-store |
| POST /api/professor/logout | Invalidate cookie/session |

Updates increment the profile version atomically. Photo DTOs contain only
the current photo ID and its API URL; private storage keys, original file
details and database credentials are not returned. Old photo objects/metadata
are retained privately; automated retention/garbage collection is future work.
This avoids deleting objects still referenced elsewhere. Local file storage
is suitable for the development demo, not shared production hosting.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run test:db
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test*uml.py' -v
```

The test runner uses only `TEST_DATABASE_URL` ending in `_test`. It runs shared
persistence tests and six additional professor API/DOM integration tests:
unauthorized/CSRF/spoofing and secret-file access; own published-post selection
and persisted edits; valid/corrupt/oversized photo requests and rollback;
actual DOM render/edit/cancel/save/escaping/conflict behavior; logout and fresh
session readback; empty listings and unauthenticated direct navigation. Photo tests use private temporary files and delete only
test-owned records/files. DOM checks use jsdom, not a real-browser screenshot.
A browser-based visual pass remains a manual check when browser automation is
unavailable.

Shared UML remains schema-generated. Professor UML now describes the actual
model and API/save flow. The old proposal is retained as historical analysis.
