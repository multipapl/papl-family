# Family Canvas

Family Canvas is a manual family tree editor built as a dark, Miro-like canvas.

The app is designed for hand-curated family data: people are added from the canvas, positioned manually, and saved through the app API. The current product does not include GEDCOM import or automatic tree layout.

Full developer notes: [docs/APP.md](docs/APP.md).

## Local Development

```bash
npm install
npm run dev
```

Open edit mode locally:

```text
http://localhost:3000/?edit=dev
```

When Redis is not configured locally, changes are stored in:

```text
.local/tree-snapshot.json
```

This file is ignored by git.

## Production

Production tree data is stored in Upstash Redis through the Vercel Marketplace.

Required environment variables:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
EDIT_SECRET
BLOB_READ_WRITE_TOKEN
```

The server also accepts the legacy `KV_REST_API_URL` and `KV_REST_API_TOKEN` names for migrated Vercel KV stores.

Use the exact `EDIT_SECRET` value in the production URL:

```text
https://your-site.vercel.app/?edit=YOUR_EDIT_SECRET
```

Do not use `dev` on Vercel. The `dev` edit secret only works locally when Redis is not configured.

Person photos are stored in Vercel Blob. Create a Blob store for the Vercel project so the deployment receives `BLOB_READ_WRITE_TOKEN`.

After changing Vercel environment variables, redeploy the project.

## Vercel Setup

1. Install an Upstash Redis integration from the Vercel Marketplace and connect it to this project.
2. Confirm Vercel has `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. Create a Vercel Blob store and confirm `BLOB_READ_WRITE_TOKEN` exists.
4. Add a strong custom `EDIT_SECRET`.
5. Redeploy.
6. Open edit mode with:

```text
https://your-site.vercel.app/?edit=YOUR_EDIT_SECRET
```

Saving the tree and uploading photos both require the same edit token.

## Image Uploads

The editor uploads person photos through Vercel Blob client uploads:

- the browser crops each selected image to a square avatar;
- the browser compresses it to a small WebP/JPEG before upload;
- the optimized file is uploaded directly to Vercel Blob;
- the tree snapshot stores only the resulting `photoUrl`.

The server route at `/api/photos/upload` requires the same edit token used for editing.

## Commands

```bash
npm run dev
npm run lint
npm test
npm run build
```
