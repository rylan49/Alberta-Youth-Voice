// BackOnline action counters (Cloudflare Worker)
//
// Tracks three independent, anonymous tallies:
//   mp_found        - a visitor successfully looked up their MP
//   email_sent      - a visitor opened a pre-written message in their email app
//   petition_signed - a visitor submitted the petition form
//
// Routes:
//   POST /api/track-action?type=<mp_found|email_sent|petition_signed>
//        -> increments that tally, returns { mp_found, email_sent, petition_signed }
//   GET  /api/action-count
//        -> returns { mp_found, email_sent, petition_signed }
//
// Storage:
//   COUNTER - Durable Object holding the three atomic, strongly-consistent totals.
//
// Privacy: no IP address, cookie, or any per-visitor data is read, hashed, or
// stored. Each request only names which of the three actions happened. Every
// reported action is counted (no rate limiting), so the totals are best-effort
// social proof, not a precise or tamper-proof figure.

const ALLOWED_ORIGINS = new Set([
  "https://backonline.ca",
  "https://www.backonline.ca",
]);

const DEFAULT_ORIGIN = "https://backonline.ca";

const ACTION_TYPES = ["mp_found", "email_sent", "petition_signed"];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body, origin, init) {
  init = init || {};
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: Object.assign(
      { "Content-Type": "application/json" },
      corsHeaders(origin),
      init.headers || {}
    ),
  });
}

async function readCounts(stub) {
  const res = await stub.fetch("https://counter/read");
  return res.json();
}

async function incrementCount(stub, type) {
  const res = await stub.fetch("https://counter/increment?type=" + type, { method: "POST" });
  return res.json();
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const stub = env.COUNTER.get(env.COUNTER.idFromName("global"));

    // GET /api/action-count
    if (url.pathname === "/api/action-count" && request.method === "GET") {
      const counts = await readCounts(stub);
      return json(counts, origin, { headers: { "Cache-Control": "public, max-age=30" } });
    }

    // POST /api/track-action?type=...
    if (url.pathname === "/api/track-action" && request.method === "POST") {
      const type = url.searchParams.get("type") || "";
      if (!ACTION_TYPES.includes(type)) {
        return json({ error: "invalid type" }, origin, { status: 400 });
      }
      const counts = await incrementCount(stub, type);
      return json(counts, origin);
    }

    return json({ error: "not found" }, origin, { status: 404 });
  },
};

// Durable Object: the single source of truth for the three tallies.
export class Counter {
  constructor(state) {
    this.state = state;
  }

  async readAll() {
    const stored = await this.state.storage.get(ACTION_TYPES);
    const out = {};
    for (const t of ACTION_TYPES) out[t] = stored.get(t) || 0;
    return out;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/increment") {
      const type = url.searchParams.get("type");
      if (ACTION_TYPES.includes(type)) {
        // The DO serializes requests, so this read-modify-write is atomic.
        const current = (await this.state.storage.get(type)) || 0;
        await this.state.storage.put(type, current + 1);
      }
    }

    return Response.json(await this.readAll());
  }
}
