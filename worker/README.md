# BackOnline action counters API

A tiny Cloudflare Worker that powers the three live tallies at the top of
[backonline.ca](https://backonline.ca) — **people that found their MP**,
**emails sent**, and **petition signatures** — **without collecting any
personal data**.

## How it works

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/track-action?type=<mp_found\|email_sent\|petition_signed>` | `POST` | Increments that tally. **No rate limiting** — every reported action counts. Returns `{ mp_found, email_sent, petition_signed }`. |
| `/api/action-count` | `GET`  | Returns the current tallies: `{ mp_found, email_sent, petition_signed }`. Cached at the edge for 30s. |

- **Counters** — a [Durable Object](https://developers.cloudflare.com/durable-objects/)
  holds the three running totals. It is strongly consistent and increments
  atomically, so concurrent actions are never lost. (Plain KV is unsuitable for a
  counter: it is eventually consistent and limits same-key writes to ~1/sec.)
- **No per-visitor tracking** — the Worker does not read, hash, log, or store the
  visitor's IP, and sets no cookies. It just adds one to a total.

> These are best-effort social proof, not an audit log. With no dedup or rate
> limiting, the totals can be inflated by anyone scripting requests (and a single
> person's repeat clicks all count). That trade-off was chosen deliberately so
> shared connections — schools, libraries, offices, VPNs — are never undercounted.

## One-time setup

You need a free Cloudflare account with the `backonline.ca` zone already on it
(you use Cloudflare's proxy, so it is). Then:

```bash
cd worker
npm install
npx wrangler login

# Deploy. The first deploy provisions api.backonline.ca (DNS + TLS) too.
npm run deploy
```

That's it — no VPS, Nginx, systemd, KV namespace, or secrets. The Worker runs on
Cloudflare's free tier.

> If you set this up earlier, the `RATELIMIT` KV namespace and the `IP_SALT`
> secret are no longer used — you can delete them from the Cloudflare dashboard.

## Local development

```bash
npm run dev          # serves on http://localhost:8787
curl -X POST "http://localhost:8787/api/track-action?type=mp_found"
curl          http://localhost:8787/api/action-count
```

## Logs

```bash
npm run tail
```
