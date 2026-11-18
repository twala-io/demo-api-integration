# Twala API showcase

A small app that shows every [Twala API](https://platform-stage.twala.ai/developer-guide)
endpoint, one feature per screen. Each screen lists the calls it makes, and
the **API log** at the bottom shows every request and response. It works with
a test key and one person: you.

Findings about the API are in [docs/dx-report.md](docs/dx-report.md), with
details in [docs/dx-findings.md](docs/dx-findings.md).

## How it fits together

```
browser (React, :5180)  →  app server (Express, :3180)  →  Twala API
  typed client                holds the API key
                              logs every call
```

Twala API keys are for servers only, and the API sends no CORS headers to
other sites. So the browser calls Twala's own paths on the app server, under
`/api/twala`, and the server forwards them with the key.

- `web/src/api.ts` is a client typed from Twala's OpenAPI document
  (`server/src/twala/schema.d.ts`, regenerated with `npm run gen:api`). Each
  screen calls it with Twala's real paths, such as
  `twala.POST('/envelopes', …)`.
- `server/src/proxy.ts` forwards only the 32 operations of the public API.
- `server/src/twala/client.ts` adds the `Authorization` header, adds an
  `Idempotency-Key` to every `POST` and to `PATCH /envelopes/{id}`, retries
  only when retrying is safe, and records every attempt.
- `server/src/webhooks.ts` receives webhooks and checks their signatures.

## Screens

| Screen | Endpoints |
| --- | --- |
| Account | `GET /account` |
| Envelopes | `POST /envelopes`, `GET /envelopes`, `GET /envelopes/{id}`, `PATCH /envelopes/{id}`, `DELETE /envelopes/{id}` |
| Recipients | `GET`, `POST /envelopes/{id}/recipients`, `PATCH`, `DELETE /envelopes/{id}/recipients/{recipientId}` |
| Documents | `GET`, `POST /envelopes/{id}/documents`, `GET`, `DELETE /envelopes/{id}/documents/{documentId}` |
| Fields | `GET`, `PUT /envelopes/{id}/recipients/{recipientId}/fields` |
| Templates | `GET /templates`, `GET /templates/{id}`, `POST /envelopes` with `templateId`. Templates are created in Twala; the API only reads and uses them. |
| Embedded sending | `POST /envelopes/{id}/views/sender` |
| Embedded signing | `POST /envelopes/{id}/views/recipient` |
| Reminders and sealing | `POST /envelopes/{id}/reminders`, `POST /envelopes/{id}/sealing-attempts` |
| Audit trail and form data | `GET /envelopes/{id}/audit-events`, `GET /envelopes/{id}/form-data` |
| Timestamps | `POST /timestamps`, `GET /timestamps`, `GET /timestamps/{id}`, `GET /timestamps/{id}/audit-events`, `GET /timestamps/{id}/document`, `POST /timestamps/{id}/sealing-attempts` |
| Events and webhooks | `GET /events`, `GET /events/{id}`, webhooks |

### Using a test key

A test key only emails the account's own address, and an envelope can't have
two recipients with the same email. So the app makes you the first recipient,
signing **embedded** (inside the app), and gives anyone else a placeholder
email such as `signer2@example.com`, also embedded. It warns before a call
Twala would refuse, and shows today's test usage at the top.

## Running it

Requires Docker with Compose. You don't need Node on your machine.

```bash
cp .env.example .env              # then paste a test key into TWALA_API_KEY
docker compose up --build         # http://localhost:5180
```

This builds the UI and runs one container that serves the UI and the API.
`.env` is read when the container starts and is never copied into the image.
After you edit `.env`, run the same command again.

To work on the code, run the `dev` service instead. It runs the server and
Vite with reload, and Compose syncs your edits into the container:

```bash
docker compose up --build --watch dev     # http://localhost:5180
```

Changes to `package.json` or `package-lock.json` rebuild the image.

### Webhooks (optional)

Twala only delivers webhooks to a public HTTPS address, so expose the app
server with a tunnel:

1. Add the `tunnel` service to your command, for example
   `docker compose up --build app tunnel` (or `--watch dev tunnel`). Copy the
   `https://….trycloudflare.com` address it prints. To find it again, run
   `docker compose logs tunnel`.
2. In Twala: **Apps** → your App → **Webhook endpoints** → add
   `<tunnel address>/webhooks/twala` in **Test** mode, for all events.
3. Copy the endpoint's signing secret into `.env` as `TWALA_WEBHOOK_SECRET`,
   then run the command again.

A quick tunnel gets a new address each time it starts, so update the endpoint
in Twala when you restart it. Without webhooks, the **Activity** feed still
lists every event from `GET /events`; click **Refresh** to catch up.

Other tasks:

| Command | Does |
| --- | --- |
| `docker compose exec dev npm run typecheck` | Type-check the server and the UI (while `dev` runs) |
| `docker compose run --rm -v ./server/src/twala:/app/server/src/twala dev npm run gen:api` | Regenerate API types from the OpenAPI document |
| `docker compose down` | Stop and remove the containers |

### Without Docker

Requires Node 22 or later.

```bash
npm install
npm run dev              # server on :3180, UI on http://localhost:5180
npm run tunnel           # in a second terminal, for webhooks
```

`npm run build` builds the UI into `web/dist`, `npm run build:server` compiles
the server into `dist`, and `npm start` runs the compiled server, which also
serves the built UI.
