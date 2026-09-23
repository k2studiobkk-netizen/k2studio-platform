# K2STUDIO Platform

Public source snapshot of the K2STUDIO storefront, member checkout and staff order/production workspace, prepared 23 September 2026. The code is open for inspection. No reuse license has been granted.

## Included

- `app/shop`: guest cart, email verification and member checkout.
- `app/account`: member-owned order history and detail.
- `app/admin`: staff orders, payments, production and sales tools.
- `app/api`, `worker`, `db`, `drizzle`: server endpoints, Cloudflare Worker and schema migrations.
- `public`: application images, hardware catalog and icons.
- `tests`: automated tests; `google-apps-script`: backup integration source.

This repository contains the current working source, including features that may still be staged or incomplete. It is not a guarantee that every feature is enabled on production. QR/automatic online payment is not enabled in the member checkout snapshot.

## Development

Requires Node.js >=22.13.0.

```sh
npm ci
npm run dev
npm run build
node --test tests/*.test.mjs
```

Configure local secrets in ignored `.dev.vars` / `.env` files. Never commit credentials or database exports. Staff accounts are deliberately NOT seeded with default passwords in this snapshot; provision initial staff access securely before use.

## Deployment safety

`wrangler.jsonc` uses placeholder resource IDs, sender and administrator details. Supply your own D1 database, R2 bucket and sender before deployment. Production settings are not included in the public snapshot.

Uploading this source does not deploy it. No GitHub Actions or automatic production deployment is configured by this backup operation.

## Source backup scope

- Public source snapshot starts a new history; the original local Git history remains untouched.
- Excludes customer database contents, uploads, slips, SQL backup exports, local secrets, caches, build outputs, local QA screenshots and operational incident reports.
- Removes legacy staff credential seeds from migration 0009. Migrations 0010 and 0031 retain their filenames but are no-ops: they originally held historical credential/customer-specific repairs. Never use this sanitized snapshot to blindly replay migrations on the existing live database.
- Experimental standalone design prototypes are not part of this production-app source snapshot.
- Live database and R2 customer attachments must be backed up separately. GitHub is a code backup, not a customer-data restore point.
