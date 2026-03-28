# RentFit API

Express + TypeScript backend for RentFit: auth (JWT in httpOnly cookies), listings, maps, and streaming AI chat via [OpenRouter](https://openrouter.ai/).

## Requirements

- Node.js **20+**
- MongoDB (local or Atlas)

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` (see [Environment](#environment)). For local MongoDB with default settings you can omit `MONGODB_URI`.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Dev server with reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run `dist/server.js` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed:service-areas` | Seed service areas |
| `npm run seed:sample-listings` | Seed sample listings |
| `npm run backfill:listing-city-slugs` | Backfill listing city slugs |

## Environment

Copy `.env.example` to `.env`. Important variables:

| Variable | Notes |
|----------|--------|
| `MONGODB_URI` | Mongo connection string |
| `JWT_SECRET` | **Required** when `NODE_ENV=production` |
| `CORS_ORIGIN` | Comma-separated allowed browser origins (scheme + host + port). Must include your frontend URL for credentialed requests |
| `AUTH_COOKIE_SAMESITE` | Leave unset in production for cross-origin SPA + API (`SameSite=None` + `Secure`). Use `lax` only when frontend and API are same-site |
| `OPENROUTER_API_KEY` | **Required** in production for chat |
| `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL` | Optional overrides |

## Local development

Default port is **8000** (`PORT`).

```bash
npm run dev
```

Health check: `GET http://localhost:8000/health`

Interactive API docs (Swagger UI) are registered in the app when you run the server (see `registerSwagger` in the codebase).

## Deploying on Vercel

This repo includes `vercel.json` and `api/index.js` so the Express app runs as a serverless function with `dist/` bundled.

1. Set the same environment variables in the Vercel project (especially `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, `OPENROUTER_API_KEY`).
2. Ensure `CORS_ORIGIN` lists your deployed frontend origin exactly, e.g. `https://your-app.vercel.app`.
3. Do not set `AUTH_COOKIE_SAMESITE=lax` when the UI is on a different host than the API.

## API overview

- **Auth** — `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET|PATCH /api/auth/me` (cookie session).
- **Chat** — `POST /api/chat` (streaming; client should send credentials).
- **Listings, map, service areas** — under `/api/listings`, `/api/map`, `/api/service-areas`, `/api/chats`.

Responses use `{ success, data }` or `{ success, error }` except where noted (e.g. chat stream).

## Related

- Frontend: [rentfit-v1-web](../rentfit-v1-web) (sibling repo or separate checkout).
