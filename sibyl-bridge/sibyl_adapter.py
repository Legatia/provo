"""Isolation layer around sibyl-memory-client.

All SDK calls live here so signature drift between SDK versions is a one-file
fix. Signatures verified against sibyl-memory-client 0.7.0 source:

    MemoryClient.local(path, *, tenant_id=...)  -> MemoryClient
    client.set_entity(category, name, body, *, status=None) -> entity dict
    client.write_event(*, evaluated=None, acted=None, forward=None,
                       extra=None, ts=None) -> event id
    client.set_reference(key, body, *, metadata=None) -> None
    client.search(query, *, limit=20, prefix=False, tiers=None) -> rows
    client.get_tenant() / set_tenant(tenant_id)
"""

import os
from typing import Any

from sibyl_memory_client import MemoryClient

DB_PATH = os.environ.get("SIBYL_DB_PATH", "~/.sibyl-memory/memory.db")
DEFAULT_TENANT = os.environ.get("SIBYL_TENANT", "desk")

_client: MemoryClient | None = None


def get_client(tenant: str | None = None) -> MemoryClient:
    """Process-wide client, switched to the requested tenant."""
    global _client
    if _client is None:
        _client = MemoryClient.local(DB_PATH, tenant_id=DEFAULT_TENANT)
    if tenant and tenant != _client.get_tenant():
        _client.set_tenant(tenant)
    return _client


def save_entity(
    tenant: str | None,
    category: str,
    name: str,
    body: dict[str, Any] | list[Any],
    status: str | None = None,
) -> dict[str, Any]:
    return get_client(tenant).set_entity(category, name, body, status=status)


def save_event(
    tenant: str | None,
    acted: list[str] | None,
    extra: dict[str, Any] | None = None,
    evaluated: Any = None,
) -> str:
    return get_client(tenant).write_event(acted=acted, extra=extra, evaluated=evaluated)


def save_reference(
    tenant: str | None,
    key: str,
    body: str | dict[str, Any] | list[Any],
    metadata: dict[str, Any] | None = None,
) -> None:
    get_client(tenant).set_reference(key, body, metadata=metadata)


def recall(tenant: str | None, query: str, k: int = 5) -> list[dict[str, Any]]:
    """Cross-tier FTS5 search, normalized for the TS side."""
    rows = get_client(tenant).search(query, limit=k)
    return [_normalize(row) for row in rows]


def health() -> dict[str, Any]:
    c = get_client()
    return {
        "ok": True,
        "db": DB_PATH,
        "tenant": c.get_tenant(),
        "tier": c.get_tier(),
        "schema_version": c.schema_version(),
    }


# ── normalization ────────────────────────────────────────────────────────────

def _flatten(value: Any) -> str:
    """Any JSON-ish payload → readable text (what the LLM should see)."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(_flatten(v) for v in value)
    if isinstance(value, dict):
        return "\n".join(
            f"{k}: {_flatten(v)}" for k, v in value.items() if v not in (None, "", [], {})
        )
    return str(value)


def _normalize(row: dict[str, Any]) -> dict[str, Any]:
    """Cross-tier search rows: {tier, key, category, body, snippet, rank, ts}."""
    tier = row.get("tier") or "reference"
    body = row.get("body")
    if tier == "journal":
        parts = [
            _flatten(body.get(k)) if isinstance(body, dict) else _flatten(body)
            for k in ("evaluated", "acted", "forward")
        ]
        text = "\n".join(p for p in parts if p)
    else:
        text = _flatten(body)
    return {
        "kind": tier,  # entity | state | reference | journal
        "category": row.get("category"),
        "name": row.get("key") or "doc",
        "text": text or row.get("snippet") or "",
        "meta": body if isinstance(body, dict) else None,
        "ts": row.get("ts"),
        "rank": row.get("rank"),
    }
