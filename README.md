# FitRoom

**AI virtual try-on studio.** Upload a photo of yourself, pick a garment from the collection or upload your own, and FitRoom generates an image of you wearing it.

**Live demo:** https://fitroom-ai.netlify.app

---

## Features

- **AI try-on on your own photo.** The result is a photo of you wearing the selected garment, produced by a virtual try-on model.
- **Two garment sources.** Choose a piece from the built-in collection (Women, Men, Kids, Unisex) or upload a photo of your own garment.
- **Garment type selection.** Uploaded garments are tagged as top, bottom or dress/full outfit so the model dresses the right part of the body.
- **Client-side image preparation.** Photos are resized in the browser before upload, which keeps requests small and fast.
- **My Fits.** Generated looks are kept on the device and can be downloaded or shared.
- **Accounts.** Email and password sign-in with Better Auth; signed-in users can save fits to their account.
- **Private image storage.** Photos and results are stored in Cloudinary as private assets and served only through an access-checked route.
- **Setup health check.** `GET /api/tryon-health` reports whether the try-on provider and storage are configured and reachable, without exposing secrets.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start (React 19, TanStack Router, server functions) |
| Styling | Tailwind CSS v4 |
| Language | TypeScript |
| Authentication | Better Auth |
| Database | SQLite via Drizzle ORM (Cloudflare D1, or the MonstarX data proxy) |
| Image storage | Cloudinary (private, authenticated assets) |
| AI try-on | PixelAPI virtual try-on (FASHN supported as an optional alternative) |
| Hosting | Netlify (primary), Cloudflare Workers (supported) |

## How it works

```
Browser                        Server functions                    External
-------                        ----------------                    --------
resize photo  ──upload──▶  validate + store photo  ─────────────▶  Cloudinary
click "Generate" ───────▶  startTryOn: load both images,
                           submit job  ─────────────────────────▶  PixelAPI
poll every 3 s ─────────▶  pollTryOn: check job status  ────────▶  PixelAPI
                           job done → save result image  ───────▶  Cloudinary
show result  ◀───────────  signed-in/guest URL via /api/files
```

- The browser never sees any API key. All provider calls happen in server functions.
- Try-on is asynchronous. Each server call is short, which keeps it within serverless time limits.
- Files are stored under `users/{userId}/tryon/…` for signed-in users and `public/tryon/…` for guests. `/api/files/*` only serves a `users/…` file to its owner.

## Getting started

### Requirements

- Node.js 22.13 or newer
- A [PixelAPI](https://pixelapi.dev) API key
- A [Cloudinary](https://cloudinary.com) account (cloud name, API key, API secret)

### Run locally

Local development runs in Cloudflare's Workers runtime with a local D1 database.

```bash
npm install
cp .dev.vars.example .dev.vars   # then add the variables listed below
npm run db:migrate:local         # creates the tables in the local D1 database
npm run dev                      # http://localhost:3000
```

Put these in `.dev.vars` for local development:

```
BETTER_AUTH_SECRET=<random string, 32+ characters>
BETTER_AUTH_URL=http://localhost:3000
PIXELAPI_API_KEY=<your key>
CLOUDINARY_CLOUD_NAME=<your cloud name>
CLOUDINARY_API_KEY=<your key>
CLOUDINARY_API_SECRET=<your secret>
```

Never commit `.dev.vars` or `.env`; both are git-ignored.

## Configuration

All variables are server-side only. Do not use a `PUBLIC_` or `VITE_` prefix for any of them. A template is provided in [`.env.example`](./.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `BETTER_AUTH_SECRET` | Yes | Signs sessions. Use a unique random value per environment. |
| `BETTER_AUTH_URL` | Yes | Canonical HTTPS origin of the deployed app. |
| `PIXELAPI_API_KEY` | Yes | Try-on provider key. |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary account. |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary credentials. |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary credentials. |
| `CLOUDINARY_FOLDER` | No | Folder prefix inside Cloudinary (default `fitroom`). |
| `MONSTARX_DATA_URL` | Netlify | Database endpoint when D1 is not available. |
| `MONSTARX_DATA_TOKEN` | Netlify | Token for the database endpoint. |
| `TRYON_PROVIDER` | No | Force `pixelapi` or `fashn`. Defaults to PixelAPI when its key is set. |
| `PIXELAPI_API_URL` | No | Override the PixelAPI base URL. |
| `PIXELAPI_TIMEOUT_MS` | No | Timeout for starting a try-on job (default 25000, max 55000). |
| `FASHN_API_KEY` | No | Only when `TRYON_PROVIDER=fashn`. |

## Deployment

### Netlify

The Netlify build uses a dedicated TanStack Start adapter and is configured in [`netlify.toml`](./netlify.toml).

1. Connect the GitHub repository to Netlify.
2. Use Node 22.13 or newer.
3. Add the variables above under **Project configuration → Environment variables**. Mark keys and secrets as secret and scope them to Builds, Functions and Runtime.
4. Set `BETTER_AUTH_URL` to the site's HTTPS address.
5. Deploy, then open `/api/tryon-health` to confirm the try-on provider and storage are ready.

The build command is `npm run build:netlify` and the publish directory is `dist/client`. Do not use `npm run build` (the Cloudflare build) on Netlify.

Cloudflare D1 bindings are not available inside Netlify functions. A database reachable over HTTP (`MONSTARX_DATA_URL` and `MONSTARX_DATA_TOKEN`) is required there for sign-in and saved fits. Photo upload and AI try-on do not depend on the database.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full checklist.

### Cloudflare Workers

```bash
npx wrangler login
npx wrangler d1 create fitroom-db        # copy the database_id into wrangler.jsonc
npm run db:migrate                       # applies migrations/ to the remote database
npx wrangler secret put BETTER_AUTH_SECRET
npm run deploy
```

Set the PixelAPI and Cloudinary values as Worker secrets in the same way.

## Project structure

```
src/
  routes/            File-based routes (/, /account) and API routes (/api/auth, /api/files, /api/tryon-health)
  server/            Server functions: try-on flow (tryon.ts) and saved fits (fits.ts)
  lib/
    pixelapi.ts      PixelAPI client (submit job, poll status, health probe)
    cloudinary.ts    Cloudinary client (signed upload, download, delete, list)
    storage.ts       Storage facade; picks Cloudinary, R2 or MonstarX storage by configuration
    auth.ts          Better Auth configuration
    db.ts            Drizzle database connection (D1 or HTTP proxy)
    fitroom.ts       Garment collection and shared types
  db/                Drizzle schema
migrations/          SQL migrations
```

## Security

- API keys and secrets live only in server-side environment variables and are never sent to the browser.
- Cloudinary assets are uploaded as `authenticated` and are not publicly reachable on Cloudinary. Every read goes through `/api/files`, which checks ownership.
- Uploads are validated for type, size and extension on both client and server, and storage keys are generated server-side.
- Provider errors are logged on the server and mapped to user-safe messages for the client.
- Output images from the provider are validated as real images before they are stored.

## Known limitations

- The free PixelAPI plan includes a small number of try-ons (32 credits each). Plan limits and pricing are set by the provider.
- The model dresses one area per request: upper body, lower body, or a full dress. Combining a top and trousers means running two try-ons.
- Best results come from a clear, front-facing, portrait photo and a garment photographed on a plain background.
- On Netlify, sign-in and saved fits need an HTTP-reachable database; Cloudflare D1 works only in the Workers build.
- The project does not yet include automated tests.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local dev server on port 3000 (Workers runtime) |
| `npm run build:netlify` | Production build for Netlify |
| `npm run build` | Production build for Cloudflare Workers |
| `npm run typecheck` | Type-check the project |
| `npm run db:migrate:local` | Apply migrations to the local D1 database |
| `npm run db:migrate` | Apply migrations to the remote D1 database |
| `npm run deploy` | Build and deploy to Cloudflare Workers |

## Acknowledgements

Bootstrapped with [MonstarX](https://github.com/) on TanStack Start. Virtual try-on by [PixelAPI](https://pixelapi.dev). Image storage by [Cloudinary](https://cloudinary.com).
