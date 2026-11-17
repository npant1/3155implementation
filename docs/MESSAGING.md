# Student–professor messaging (issue #8)

Branch: **student-professor-messaging**. This is a standalone messaging page
with its API and shared PostgreSQL support. Profile pages, profile editing,
and the full portal are not included on this branch. It implements the inbox,
people search, chat page, sending and persistent history for
[issue #8](https://github.com/npant1/3155implementation/issues/8), following
[Figma frame 189:288](https://www.figma.com/proto/d0P8tCCwxmCInTN8C4LEjg/Main?node-id=189-288).

## Start and demonstrate

Use Node 24 and the local database setup in [DATABASE.md](DATABASE.md).
Existing team members pull this branch, install locked dependencies, generate
the client, and apply the new migration to their development database:

```bash
npm ci
npm run db:generate
npm run db:init
npm run db:seed
npm start
```

Open **http://127.0.0.1:8000/#/messages**. If another local demo occupies 8000,
start this checkout with `PORT=8001 npm start` and use that port instead.

1. Choose **Continue as sample student** (Jamie Rivera) or **Continue as sample
   professor** (Alex Morgan). These are synthetic development identities.
2. Open an Inbox conversation or select **Find Professors / Find Students**.
3. Search by name, research interest/topic, department or major. Select a
   person to open the existing pair's chat or create one.
4. Write a message and select **Send**. Ctrl/Command + Enter also sends;
   ordinary Enter adds a new line. Empty/whitespace messages are blocked.
5. Use **Load older messages** to inspect earlier history. Messages remain in
   PostgreSQL across page reloads, logout, or server restarts.
6. Use **Switch demo account / Log out**, then choose the opposite sample role
   to see the other side and reply. Two separate browser profiles/private
   windows can demonstrate both roles simultaneously. Tabs sharing the same
   browser cookies share the same messaging identity. Stale views are rejected
   if another tab switches identities, preventing sends as the wrong visible account.

The root URL opens directly to the messaging page. The header's Back control
returns to the Inbox section. A future host portal can link to `#/messages`;
there are no profile or portal routes in this standalone feature.

## Acceptance criteria

| Requirement | Implemented behavior |
| --- | --- |
| Easy navigation | Direct messaging entry, Back to Inbox, Find People, New Message and account switch controls |
| Find a professor or student | Server-side opposite-role directory; case-insensitive name, department/major and research search; 30-row pages; no-match state |
| Message page/functionality | Role-aware inbox and current-chat panel; both roles send; strict validation; duplicate-safe retry |
| View history | Participant-only chronological messages, latest 50 initially, older-page controls, timestamps, persistence and periodic refresh |

The visible layout retains the reference's green header, overlapping search
field, pill controls, conversation cards, initials avatars, new-message
button, current-chat header and two bubble styles. Vector assets are local
Figma exports in `assets/messaging/`; no temporary asset URLs are used. Peer
names, initials, previews, counts and message text come from real development
records rather than the Figma sample text.

## Persistence and privacy

`src/data/messaging.ts` provides validated directory, inbox, history, and send
operations. `src/messaging-routes.ts` handles the HTTP/session boundary.
`messaging.js` renders escaped text and calls those endpoints. No database
credentials are sent to the browser.

Migration `202611150005_messaging_history` adds:

- `Conversation.lastMessageAt` plus participant/activity indexes for inbox
  ordering. Existing history is backfilled; a PostgreSQL insert trigger keeps
  activity current for every message writer, including older data-layer code.
- Nullable `Message.clientMessageId` and a unique `(senderId, clientMessageId)`
  key. Existing rows and older writers remain compatible. The messaging API
  requires a UUID for every new send. Exact retries return the same row;
  reusing a key for different text or a different conversation returns 409.

Directory queries expose only IDs, roles, display names, department/major and
research labels. History and sending check membership using the **session's**
actor ID. A client cannot choose its sender ID, see another pair's history,
use an unrelated message cursor, or create a conversation between two other
people. A database trigger also verifies that every sender is a participant.
There is one conversation per student/professor pair.

The server binds to loopback and requires same-origin writes. Messaging has
its own random HttpOnly, SameSite=Strict cookie, distinct from the professor
profile demo session. The two sample roles are server-mapped to seeded IDs;
arbitrary actor selection is rejected. Session expiry is eight hours. This
is **local development authentication only**. Real multi-user authentication
and public deployment require the team's authentication provider; the sample
account chooser must never be exposed as production sign-in.

## Interaction and failure behavior

- Opening a different conversation disables the old composer while the new
  recipient/history loads. A stale response cannot replace a newer selection.
- Drafts are kept per conversation while the page is open. Sending disables
  that composer until a response arrives; failures preserve the draft and
  retry identifier. A lost acknowledgement can safely be retried once or more.
- Message text uses text nodes/escaping, including HTML-looking content.
- Visible messages refresh every four seconds while the page is active.
  Polls do not overlap; background tabs stop polling. Incremental pages catch
  up bursts, and the latest page is reconciled for equal-timestamp messages.
  Loaded older history and draft text are preserved. Refresh is polling,
  not WebSocket delivery, and unread/read receipts are not claimed.
- Directory and inbox have loading, empty/no-match and error states. Lists
  page 30 records at a time; history pages contain 50. Paging cursors are
  validated inside their conversation.
- No attachments, group chats, notifications, message editing/deletion, or
  production account registration are part of this story.

## Verification and diagrams

```bash
npm run db:validate
npm run lint
npm run typecheck
npm test
npm run test:db
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test*uml.py' -v
```

The integration suite creates only random test-owned records in a `_test`
database. It covers session/origin/actor restrictions, both-role directory
search, private and paged history, pair reuse, two-way delivery, concurrent
idempotent retries, invalid messages, logout/reconnect, and actual DOM
search/open/send/history interactions. The DOM test simulates a committed
send whose acknowledgement was lost, confirms a retry creates exactly one
message, verifies HTML is rendered safely, checks reply refresh, and checks
that the old composer is disabled during a delayed conversation switch.
Shared database regression tests also run; profile UI tests are outside this branch.

The schema-derived [class diagram](uml/shared-data-class.svg) includes the
new fields/index relationships. The implemented messaging flow appears in
[messaging-sequence.svg](uml/messaging-sequence.svg), with editable
[PlantUML](uml/messaging-sequence.puml). See [UML instructions](uml/README.md).
DOM testing uses jsdom. A real-browser screenshot/visual check is a manual
step when browser automation is unavailable.
