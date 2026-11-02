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
4. Configure a persistent database and object store:
   - MonstarX deployments can use the MonstarX data and storage endpoints and
     server-side token supplied by that host.
   - For a standalone Netlify deployment, provide the existing MonstarX data
     proxy variables if the database is hosted there, and configure Cloudflare
     R2 with `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and
     `R2_BUCKET_NAME`. Add `R2_PUBLIC_BASE_URL` only when the bucket's public
     objects are intentionally exposed through a public domain.
   - The Cloudflare D1 binding in `wrangler.jsonc` is for the Cloudflare Worker
     build; it is not automatically available inside Netlify functions.
5. Set `BETTER_AUTH_SECRET` to a unique random value and `BETTER_AUTH_URL` to
   the canonical HTTPS origin of the deployed app.
6. Set `FASHN_API_KEY` to a server-side FASHN API key. FitRoom submits the
   uploaded person photo and garment image to FASHN, polls the real prediction,
   then stores the returned image. Missing credentials and provider failures are
   shown as errors; the app does not substitute a model photo or synthetic
   success.

After deployment, verify sign-in, a photo upload, a garment upload, and one real
try-on using the production site's configured storage and FASHN credentials.

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
