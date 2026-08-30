"""sibyl-bridge — thin HTTPS bridge between Convex cloud actions and the
local-first Sibyl Memory SDK (sibyl-memory-client, SQLite file).

The agent runs in Convex actions (TypeScript, serverless — no Python, no local
files). Its long-term memory lives in a local SQLite file that only this
service touches. Run it somewhere persistent (Fly.io volume, or a local Mac
behind a *named* cloudflared tunnel during the demo).

Env:
    SIBYL_BRIDGE_TOKEN  required — shared secret, sent as `Authorization: Bearer <t>`
    SIBYL_DB_PATH       optional — default ~/.sibyl-memory/memory.db
    SIBYL_TENANT        optional — default tenant id, "desk"

Run:
    uvicorn main:app --host 0.0.0.0 --port 8123
"""

import os
import sys
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

import sibyl_adapter

BRIDGE_TOKEN = os.environ.get("SIBYL_BRIDGE_TOKEN", "")
if not BRIDGE_TOKEN:
    sys.exit("SIBYL_BRIDGE_TOKEN is required (the bridge is unauthenticated without it)")

app = FastAPI(title="sibyl-bridge", version="0.1.0")


def require_token(authorization: str | None = Header(default=None)) -> None:
    expected = f"Bearer {BRIDGE_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="bad or missing bridge token")


class SaveReq(BaseModel):
    tenant: str | None = None
    kind: str = "entity"  # "entity" | "event" | "reference"
    category: str = "note"
    name: str = ""
    text: str | None = None
    body: dict[str, Any] | list[Any] | None = None
    meta: dict[str, Any] | None = None
    status: str | None = None


class RecallReq(BaseModel):
    tenant: str | None = None
    query: str
    k: int = 5


@app.get("/health")
def health(_: None = Depends(require_token)) -> dict[str, Any]:
    return sibyl_adapter.health()


@app.post("/save")
def save(req: SaveReq, _: None = Depends(require_token)) -> dict[str, Any]:
    if req.kind == "entity":
        if not req.name:
            raise HTTPException(status_code=422, detail="entity save requires `name`")
        body = req.body if req.body is not None else {"text": req.text or "", **(req.meta or {})}
        row = sibyl_adapter.save_entity(req.tenant, req.category, req.name, body, req.status)
        return {"saved": "entity", "name": row.get("name"), "category": row.get("category")}
    if req.kind == "event":
        acted = [req.text] if req.text else None
        event_id = sibyl_adapter.save_event(req.tenant, acted, extra=req.meta)
        return {"saved": "event", "id": event_id}
    if req.kind == "reference":
        if not req.name:
            raise HTTPException(status_code=422, detail="reference save requires `name` (the key)")
        payload: str | dict[str, Any] | list[Any] = (
            req.body if req.body is not None else (req.text or "")
        )
        sibyl_adapter.save_reference(req.tenant, req.name, payload, metadata=req.meta)
        return {"saved": "reference", "key": req.name}
    raise HTTPException(status_code=422, detail=f"unknown kind: {req.kind}")


@app.post("/recall")
def recall(req: RecallReq, _: None = Depends(require_token)) -> dict[str, Any]:
    if not req.query.strip():
        raise HTTPException(status_code=422, detail="empty query")
    memories = sibyl_adapter.recall(req.tenant, req.query, k=max(1, min(req.k, 20)))
    return {"query": req.query, "count": len(memories), "memories": memories}
