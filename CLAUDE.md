# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AWSPowerToolKit — a browser-only suite of tools with a navigation shell (`src/App.tsx` + `src/components/AppShell/NavSidebar.tsx`) and three independent modules, each living under `src/modules/<module>/<Name>Module.tsx`:

- **SQS Explorer** (`src/modules/sqs/SqsExplorerModule.tsx`) — list queues, receive/filter/delete/send messages, purge a queue, via `@aws-sdk/client-sqs`.
- **S3 Explorer** (`src/modules/s3/S3ExplorerModule.tsx`) — list buckets, browse objects by prefix, view metadata/content, delete/rename/change storage class/restore objects, via `@aws-sdk/client-s3`.
- **Database** (`src/modules/database/DatabaseExplorerModule.tsx`) — connect to Mongo/DocumentDB (connection string or host/user/password), browse databases/collections, run `find` queries. Unlike the other two modules, this one only works under `npm run dev` (see the dev-proxy section below) because the `mongodb` driver can't run in a browser at all.

There is no backend server for any module in production. AWS/Mongo credentials entered in the UI are used directly from the browser (or, for Mongo, from the dev-only proxy) and connections persist in `localStorage`. **Each module owns its connections independently — there is no shared connection/credential state between SQS, S3, and Database.** Keep that in mind when touching connection handling — nothing about credential storage should be assumed to be secure by default, since it's a local dev tool, not a hosted multi-user app.

## Commands

- `npm run dev` — start Vite dev server (includes the SQS CORS proxy and the Mongo dev proxy, see below; required for real AWS/Mongo calls to work)
- `npm run build` — typecheck (`tsc -b`) then production build via Vite
- `npm run lint` — run oxlint (config: `.oxlintrc.json`)
- `npm run preview` — preview the production build

There is no test suite configured in this repo.

## Architecture

### The dev-only proxies are load-bearing

`vite.config.ts` registers two dev-only Vite plugins. Neither exists in production builds (GitHub Pages is static hosting), so any module that depends on one must degrade gracefully (banner instead of a broken UI) when `!import.meta.env.DEV`.

1. **SQS proxy (`sqsDevProxy`)** — Amazon SQS does not return CORS headers, so the browser cannot call `sqs.<region>.amazonaws.com` directly. This is solved by a pipeline spanning two files:
   - `src/aws/sqsClient.ts` — `createSqsClient` builds an `SQSClient` where, in dev (`import.meta.env.DEV`), the `requestHandler` is a `DevProxyHttpHandler` that lets the AWS SDK sign the request normally against the real `sqs.<region>.amazonaws.com` host, then rewrites only the *physical* connection target to same-origin `/aws-proxy/<region>/...` right before the fetch fires. The signed `Authorization` header stays valid because only the transport target changed, not the signed request.
   - `vite.config.ts` — the `sqsDevProxy()` middleware handles `/aws-proxy/<region>/...`, reconstructs the real AWS URL, forwards the already-signed request bytes verbatim, and streams the response back same-origin.
   - In production, `SqsExplorerModule.tsx` shows a banner warning that AWS calls will fail on the published site and that real usage requires cloning the repo and running `npm run dev`. Any change to request signing, headers, or the client construction must keep this dev-proxy path intact or real SQS calls break silently.
2. **Mongo proxy (`mongoDevProxy`)** — the `mongodb` driver's wire protocol can't run in a browser at all (not just a CORS issue), so, unlike SQS, this isn't a signed-request passthrough: the real driver runs in Node inside the Vite dev server and talks to the actual database. It exposes JSON POST routes under `/mongo-proxy/...` (`verify`, `databases`, `collections`, `query`), keeps a `MongoClient` cache keyed per connection (same spirit as `clientCache` in `sqsService.ts`), and is consumed from the frontend only via `src/db/mongoClient.ts` (never `fetch`ed directly elsewhere — see `src/db/mongoService.ts`). `DatabaseExplorerModule.tsx` shows a banner when `!import.meta.env.DEV` explaining the module can't function on the published site.

S3 does not need a bespoke proxy: buckets can serve CORS headers natively when configured for it, so `src/aws/s3Client.ts` talks to AWS directly even in production — if a bucket lacks CORS config, requests to it will fail, which is expected and not an app bug.

### State layout

Each module has its own persisted connections store plus its own in-memory explorer store — none of them share state:

- `connectionsStore` (`src/store/connectionsStore.ts`) — persisted (`localStorage`, key `sqs-explorer-connections`) list of `AwsConnection`s (name, region, credentials) plus which one is active, for SQS.
- `s3ConnectionsStore` (`src/store/s3ConnectionsStore.ts`) — persisted (`localStorage`, key `aws-powertoolkit-s3-connections`) list of `S3Connection`s, independent of SQS's connections even though the credential shape is the same.
- `mongoConnectionsStore` (`src/store/mongoConnectionsStore.ts`) — persisted (`localStorage`, key `aws-powertoolkit-mongo-connections`) list of `MongoConnection`s (connection string, or host/port/user/password/database).
- `explorerStore` (`src/store/explorerStore.ts`) — in-memory only, SQS. Holds open "queue tabs", each keyed by `tabKey(connectionId, queueUrl)` = `` `${connectionId}:${queueUrl}` ``. Each `QueueTab` carries its own messages, filters, loading state, and last error, so switching connections/queues doesn't clobber other tabs' state. Messages are deduped by `messageId` when appended (`appendMessages`).
- `s3ExplorerStore` (`src/store/s3ExplorerStore.ts`) — in-memory only, S3. Same tab-per-resource pattern keyed by connection + bucket, tracking current prefix ("folder"), listed objects, name filter, loading, and error per tab.
- `databaseExplorerStore` (`src/store/databaseExplorerStore.ts`) — in-memory only, Database. Same tab-per-resource pattern keyed by connection + database + collection, tracking the last query's documents, loading, and error per tab.
- `appShellStore` (`src/store/appShellStore.ts`) — in-memory only, holds which module (`ModuleId` from `src/types/module.ts`) is active in the nav shell; not tied to any single module's data.

AWS/Mongo list calls go through `@tanstack/react-query` (see `QueueSidebar.tsx`'s `useQuery(['queues', connectionId], ...)`, and the analogous bucket/database listing queries) only for read/list operations tied to a query key; mutating operations (receive/send/delete/purge for SQS; delete/rename/storage-class/restore for S3; running a query for Database) are imperative calls invoked directly from component handlers, not react-query mutations — follow whichever pattern the surrounding code already uses for a given operation rather than mixing them.

### AWS/Mongo access layers

- All SQS API calls live in `src/aws/sqsService.ts` and go through a per-connection cached `SQSClient` (`clientCache`, keyed by connection id + region + access key + session token — see `clientCacheKey`). Do not construct `SQSClient` directly elsewhere; add new operations here and reuse `getClient`.
- All S3 API calls live in `src/aws/s3Service.ts` and go through `src/aws/s3Client.ts`'s cached `getClient`, same keying pattern as SQS. Do not construct `S3Client` directly elsewhere.
- All Mongo access from the frontend goes through `src/db/mongoService.ts`, which calls `src/db/mongoClient.ts` (a thin `fetch` wrapper around `/mongo-proxy/...`) — `mongoService` must never `fetch` directly, and its routes must match what `mongoDevProxy` in `vite.config.ts` exposes.

Notable SQS behaviors to preserve when editing `sqsService.ts`:
- `receiveMessages` paginates in batches of up to 10 (AWS's per-request max) up to `options.maxMessages`, dedupes by `MessageId` within the call, and stops early once AWS returns fewer messages than requested.
- `releaseAfterReceive` immediately sets `VisibilityTimeout: 0` after receiving each message (via `ChangeMessageVisibilityCommand`) so messages become instantly re-visible instead of being held for the full visibility timeout — this is what lets the UI "peek" at messages non-destructively.
- FIFO-only fields (`MessageGroupId`, `MessageDeduplicationId`, and `DelaySeconds` being disallowed) are gated on `queue.isFifo` (derived from the queue URL ending in `.fifo`, see `queueNameFromUrl`/`listQueues`).

Notable S3 behaviors to preserve when editing `s3Service.ts`:
- `renameObject` is implemented as copy + delete (S3 has no native rename).
- `setStorageClass` is a copy-in-place with a new `StorageClass`.
- `restoreObject` uses `RestoreObjectCommand`, relevant only for objects in Glacier/Deep Archive storage classes.

### UI structure

- `App.tsx` is the top-level shell: header ("AWSPowerToolKit"), `NavSidebar` (module picker, left), and the active module's component (right) based on `appShellStore.activeModule`.
- `NavSidebar` (`src/components/AppShell/NavSidebar.tsx`) — renders `MODULES` from `src/types/module.ts`, highlights the active module, calls `setActiveModule` on click.
- **SQS Explorer module** (`src/modules/sqs/SqsExplorerModule.tsx`) — own header, dev/prod CORS warning banner, `QueueSidebar` (connection picker + queue list/search, react-query backed) + `MessageExplorer` (`TabsBar` for open queue tabs + `QueueView` — toolbar, filters, message table, detail drawer) side by side, and the `ConnectionManager` modal (shown when there are no connections yet, or on demand). Filtering logic (`src/utils/attributeFilter.ts`) supports filtering by body, messageId, or a named message attribute, with `contains`/`notContains`/`equals`/`notEquals` operators (`src/types/filter.ts`), applied client-side over already-received messages — it does not change what's fetched from AWS.
- **S3 Explorer module** (`src/modules/s3/S3ExplorerModule.tsx`) — `BucketSidebar` (bucket picker, react-query backed) + `ObjectBrowser` (object table with prefix/breadcrumb navigation and client-side name filter) + `ObjectDetailDrawer` (metadata/content preview) + `ObjectActionsMenu` (delete/rename/storage class/restore, each behind a confirmation dialog), and the `S3ConnectionManager` modal.
- **Database module** (`src/modules/database/DatabaseExplorerModule.tsx`) — `ContainerSidebar` (database → collection tree/search) + `QueryEditor` (JSON `find` filter input) + `ResultsGrid` (document table with per-document detail), and the `MongoConnectionManager` modal. Shows an amber warning banner when `!import.meta.env.DEV` since this module cannot function on the published (static) site.
- User-facing copy is in Spanish (e.g. "Conectar a AWS", "Elegí una cola...") — match this when adding UI strings, in any module.

### Styling

Tailwind CSS v4 via `@tailwindcss/vite` (no separate `tailwind.config.js` — v4 is CSS-driven, see `src/index.css`). Components hand-roll `dark:` variants throughout rather than relying on a theme abstraction; keep light/dark pairs in sync when editing className strings.

### Build/deploy specifics

- `vite.config.ts` sets `base: '/AWSPowerToolKit/'` for GitHub Pages hosting — don't remove this or asset paths break on the deployed site. This matches the GitHub repo name (renamed from `SQSExplorer`); keep both in sync if the repo is ever renamed again.
- Deploys happen automatically on push to `main` via `.github/workflows/deploy.yml` (builds and pushes `dist/` to the `gh-pages` branch). There's no staging step; merging to `main` is effectively shipping. The Database module cannot work on the deployed site at all (no backend/proxy there) — this is expected, not a bug, and is surfaced to the user via the module's own banner.
