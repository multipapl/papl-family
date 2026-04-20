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

When Vercel KV is not configured, local changes are stored in:

```text
.local/tree-snapshot.json
```

This file is ignored by git.

## Production

Production tree data is stored in Vercel KV.

Required environment variables:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
EDIT_SECRET
```

Person photos are stored in Vercel Blob. Create a Blob store for the Vercel project so the deployment receives:

```text
BLOB_READ_WRITE_TOKEN
```

Open edit mode in production:

```text
https://your-site.vercel.app/?edit=YOUR_EDIT_SECRET
```

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
