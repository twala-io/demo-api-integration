# Hiring desk

A demo HR hiring desk built on the [Twala API](https://platform-stage.twala.ai/developer-guide).
It covers every endpoint so we can test two things: whether the API works as
documented, and how easy it is to integrate. The results are in
[docs/dx-report.md](docs/dx-report.md), with phase-by-phase details in
[docs/dx-findings.md](docs/dx-findings.md). For a step-by-step guide to every
flow and the endpoints it calls, see
[docs/hiring-desk-flows.pdf](docs/hiring-desk-flows.pdf).

## How it fits together

```
browser (React, :5180)  →  app server (Express, :3180)  →  Twala API
                              holds the API key
                              logs every call
```

Twala API keys are for servers only, and the API sends no CORS headers to
other sites. So the browser never talks to Twala directly. The app server
holds the key and makes every call.

- `server/src/twala/client.ts` is a typed client generated from Twala's
  OpenAPI document. It adds the `Authorization` header, adds an
  `Idempotency-Key` to every `POST` and to `PATCH /envelopes/{id}`, retries
  only when retrying is safe, and records every attempt.
- `server/src/twala/schema.d.ts` is generated. Regenerate it with
  `npm run gen:api`, which reads `openapi.json` from `TWALA_API_BASE`.
- The **API log** drawer at the bottom of the app shows each call with its
  status, error `code`, `X-Request-ID`, rate-limit headers, idempotency key,
  and request and response bodies.

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

## Build phases

| # | Phase | Endpoints |
| --- | --- | --- |
| 0 | Scaffold: client, API log, config | `openapi.json` |
| 1 | Account panel and credits | `GET /account` |
| 2 | Send offer letter | `POST /envelopes`, `PATCH /envelopes/{id}`, `DELETE /envelopes/{id}` |
| 3 | Candidate pipeline | `GET /envelopes`, envelope, recipients, documents, document download, audit events, form data |
| 4 | Embedded signing and sending | `views/recipient`, `views/sender` |
| 5 | Live status | `GET /events`, `GET /events/{id}`, webhooks |
| 6 | Drafts and templates | add/remove documents and recipients, get/replace fields, templates |
| 7 | Fixes and nudges | correct a recipient, reminders, void, expiry, metadata, sealing retries |
| 8 | Pre-employment requirements | timestamps |
| 9 | Developer-experience report | — |
