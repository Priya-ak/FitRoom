# FitRoom deployment

## Netlify

This project keeps its Cloudflare Workers build and uses a separate TanStack Start
adapter for Netlify. The Netlify build runs `npm run build:netlify`, publishes
`dist/client`, and deploys server functions through
`@netlify/vite-plugin-tanstack-start`. Do not use the Cloudflare build command
(`npm run build`) for a Netlify site.

1. Connect the repository to Netlify and use the build settings in `netlify.toml`.
2. Set the site's Node version to **22.13 or newer**.
3. Configure the environment variables listed in `.env.example` in Netlify's
   environment settings. Do not commit `.env` or paste secret values into a
   `PUBLIC_*` or `VITE_*` variable.
4. Configure image storage with **Cloudinary** (takes priority over every other backend):
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — mark the key and
     secret as *Contains secret values* in Netlify. Optional `CLOUDINARY_FOLDER` (default `fitroom`).
   - Assets are uploaded as `type: authenticated`, so they are never publicly reachable on
     Cloudinary. The browser loads them through `/api/files/<key>`, which checks that the
     signed-in user owns `users/<id>/…` files before streaming them.
5. Configure the database. Cloudflare D1 (`wrangler.jsonc`) is not available inside Netlify
   functions; set `MONSTARX_DATA_URL` and `MONSTARX_DATA_TOKEN`, otherwise sign-in and saved fits fail.
6. Set `BETTER_AUTH_SECRET` to a unique random value and `BETTER_AUTH_URL` to
   the canonical HTTPS origin of the deployed app.
7. Set `PIXELAPI_API_KEY` (secret) for AI try-on. FitRoom submits the person photo and garment
   image to PixelAPI's async `/v1/virtual-tryon` endpoint, polls the job from the browser through
   short server-function calls (safe for Netlify time limits), then stores the result in Cloudinary.
   Each try-on costs 32 PixelAPI credits; the free trial's 300 credits cover about 9 try-ons.
   FASHN remains available as a fallback with `TRYON_PROVIDER=fashn` + `FASHN_API_KEY`.
   Missing credentials and provider failures are shown as errors; the app never substitutes a
   model photo or synthetic success.

After deployment, verify sign-in, a photo upload, a garment upload, and one real
try-on using the production site's Cloudinary storage and PixelAPI credentials.

## Cloudflare Workers

The existing Cloudflare configuration remains available:

```sh
npm run db:migrate
npx wrangler secret put BETTER_AUTH_SECRET
npm run deploy
```

Create/configure the D1 database referenced by `wrangler.jsonc` before applying
migrations. For a Worker binding, create an R2 bucket and add its binding to
`wrangler.jsonc`:

```jsonc
"r2_buckets": [
  { "binding": "FITROOM_BUCKET", "bucket_name": "fitroom-uploads" }
]
```

Alternatively, configure the S3-compatible `R2_*` credentials as Worker
secrets/variables. Set `FASHN_API_KEY` as a Worker secret to enable real try-on
generation.

## Local development

For the Cloudflare-local development flow, copy `.dev.vars.example` to
`.dev.vars`, set a unique `BETTER_AUTH_SECRET`, and run:

```sh
npm run db:migrate:local
npm run dev
```

Without a remote storage provider, development uploads use local storage and are
not durable across production server instances. Production uploads fail clearly
when persistent object storage is not configured.
