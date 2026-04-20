# Family Canvas

## Purpose

Family Canvas is a manual family tree editor. It behaves like a simple dark Miro board, but it is tailored for family relationships: person cards, partnerships, children, siblings, family branches, collapsed subtrees, and manual positioning.

The current approach is intentionally manual. GEDCOM import, automatic layout, and old prefilled JSON data are not part of the active product.

## Main Workflow

1. Open the app.
2. Enter edit mode with `?edit=...`.
3. Add the first person.
4. Use the `+` button on a card to add relatives.
5. Drag cards manually on the canvas.
6. Fill person data in the edit sidebar.
7. Create custom branches when needed and filter the tree by branch.
8. After local verification, deploy to Vercel and continue filling the final tree in production.

## UI And UX

- The product UI is intentionally Russian because it is used by the family.
- The theme is dark and calm, with no light canvas.
- The canvas stays visually clean and has no visible grid.
- A hidden `20px` grid keeps manual positioning tidy.
- The canvas supports pan and zoom.
- Cards can be moved only in edit mode.
- The card `+` button opens the relative creation menu.
- The pencil button opens person editing.
- Collapse controls show when ancestors or descendants are hidden.
- The branch filter is a dropdown.
- There are no default branches: users create branches themselves.

## Person Data

A person card stores:

- `givenName`: first name;
- `surname`: surname;
- `maidenName`: maiden name;
- `gender`: gender;
- `birthDate`: birth date;
- `deathDate`: death date;
- `isDeceased`: deceased flag;
- `note`: free-form note;
- `photoUrl`: public photo URL;
- `branchId`: selected branch;
- `primaryUnionId`: preferred partner union.

Dates are stored in one of these formats:

- `YYYY`
- `YYYY-MM`
- `YYYY-MM-DD`

## Tree Model

Data is stored as a `TreeSnapshot`:

- `branches`: custom family branches;
- `people`: people;
- `unions`: partnerships;
- `parentChildRelations`: child-to-union links;
- `canvas.people`: manual card coordinates;
- `canvas.collapsedPersonIds`: collapsed descendant subtrees;
- `canvas.collapsedAncestorPersonIds`: collapsed ancestor subtrees.

A child is attached to a union, not to a single parent. This supports couples, single parents, multiple partnerships, and children from different unions.

## Local Storage

Local data is not stored in `localStorage`. It is saved through the app API into:

```text
.local/tree-snapshot.json
```

This file is ignored by git and should not be committed.

Open local edit mode with:

```text
http://localhost:3000/?edit=dev
```

When Redis is not configured locally, the local API accepts the secret `dev`.

## Production Storage

Production tree data should live in Upstash Redis through the Vercel Marketplace.

Required environment variables:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
EDIT_SECRET
```

The server also accepts the legacy `KV_REST_API_URL` and `KV_REST_API_TOKEN` names for migrated Vercel KV stores.

When Redis is configured, the API uses:

- `family-tree:snapshot`: the latest tree snapshot;
- `family-tree:backups`: the last backups created before saves.

Open production edit mode with:

```text
https://your-site.vercel.app/?edit=YOUR_EDIT_SECRET
```

## Photo Storage

Person photos are stored in Vercel Blob, while `TreeSnapshot` stores only each person's `photoUrl`.

Required Vercel Blob environment variable:

```text
BLOB_READ_WRITE_TOKEN
```

The upload flow is:

1. The browser receives a selected image from the user.
2. The browser crops the image to a square avatar.
3. The browser compresses it to a small WebP/JPEG file.
4. The optimized file uploads directly to Vercel Blob through a client upload token.
5. The returned Blob URL is written into the person draft.
6. The user saves the person to persist `photoUrl` in the tree snapshot.

The upload token route is `/api/photos/upload`. It requires the edit token and limits uploaded optimized files to `512 KB`.

## Migrating Local Data To Vercel

If the tree was partially filled locally, post the local snapshot to production:

```powershell
curl.exe -X POST "https://your-site.vercel.app/api/tree" `
  -H "Authorization: Bearer YOUR_EDIT_SECRET" `
  -H "Content-Type: application/json" `
  --data-binary "@.local/tree-snapshot.json"
```

After that, Vercel will serve the tree data from Redis.

## Current Code Structure

```text
src/app/api/tree/route.ts           tree read/write API
src/app/api/photos/upload/route.ts  Vercel Blob client upload token API
src/components/FamilyTree.tsx       top-level tree editor component
src/components/canvas/              canvas, cards, and connectors
src/components/ui/                  sidebars, branch dropdowns, person details
src/domain/types.ts                 domain model types
src/domain/treeQueries.ts           indexes and query helpers
src/hooks/usePanZoom.ts             canvas pan/zoom state
src/hooks/useEditMode.ts            edit mode state and token handling
src/hooks/useTreeData.ts            snapshot loading and saving
src/layout/familyLayout.ts          manual coordinates and fallback positions
src/lib/photoOptimizer.ts           client-side avatar compression
src/lib/redis.ts                    Upstash Redis client
src/persistence/api.ts              tree API client calls
src/persistence/photos.ts           photo upload client calls
src/data/seed.json                  empty starter snapshot
```

## Commands

```bash
npm run dev
npm run lint
npm test
npm run build
```

## Out Of Scope

- GEDCOM import.
- Automatic generational layout.
- `localStorage` as the storage backend.
- Prefilled family branches.
- Default family data in the repository.
