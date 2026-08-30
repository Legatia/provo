# sibyl-bridge

FastAPI bridge between the Convex agent (TypeScript, cloud) and the local-first
**Sibyl Memory** SDK (`sibyl-memory-client`, SQLite at `~/.sibyl-memory/`). This
is the only process that touches the memory file; Convex talks to it over HTTPS.

## Run locally

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export SIBYL_BRIDGE_TOKEN=$(openssl rand -hex 24)   # put the same value in Convex env
uvicorn main:app --host 0.0.0.0 --port 8123
```

`sibyl init` (from `pip install 'sibyl-memory-cli[mcp]'`) must have been run once
so the SDK has credentials; without it the client still works locally with a
strict 5 MB free-tier cap.

## Endpoints

| Route | Body | Effect |
|---|---|---|
| `GET /health` | — | `{ok, db, tenant, tier, schema_version}` |
| `POST /save` | `{kind: "entity"\|"event"\|"reference", category, name, text, body?, meta?, status?, tenant?}` | WARM entity / COLD journal event / REFERENCE doc |
| `POST /recall` | `{query, k?, tenant?}` | Cross-tier FTS5 search → `{count, memories:[{kind, category, name, text, ts}]}` |

Auth: `Authorization: Bearer $SIBYL_BRIDGE_TOKEN` on every route.

```bash
curl -s localhost:8123/health -H "Authorization: Bearer $SIBYL_BRIDGE_TOKEN"

curl -s localhost:8123/save -H "Authorization: Bearer $SIBYL_BRIDGE_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"kind":"entity","category":"resolved_incident","name":"checkout-latency-desktop",
       "body":{"title":"Checkout latency (desktop)","resolutionNote":"payment provider timeout, failover applied"}}'

curl -s localhost:8123/recall -H "Authorization: Bearer $SIBYL_BRIDGE_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"query":"checkout slow payments desktop","k":5}'
```

## Demo-day hosting

Never use an ephemeral quick-tunnel. Either a Fly.io free volume (always-on) or
a local Mac behind a **named** cloudflared tunnel:

```bash
cloudflared tunnel create sibyl-bridge
cloudflared tunnel route dns sibyl-bridge bridge.example.com
cloudflared tunnel run sibyl-bridge
```

Point Convex env `SIBYL_BRIDGE_URL` at the public URL, `SIBYL_BRIDGE_TOKEN` at
the same secret. The dashboard's Demo panel shows a live health chip fed by
`GET /health`.

> Memory is load-bearing by design: if the bridge is down while memory is on,
> the agent proceeds **without** historical context and logs the failure —
> decisions demonstrably get worse. That's the point.
