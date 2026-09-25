import json
import os
import re
from starlette.types import ASGIApp
from typing import Iterator, List, Optional

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import engine, Base, get_db
from .models import Entity, Alert
from .schemas import EntityOut, AlertOut, IsolationForestRequest, IsolationForestResponse
from .analytics import run_multivariate_isolation_forest
from . import ai as local_ai

# Create tables in SQLite / PostgreSQL
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SAT-SA Supervisory Analytics API",
    description="Offline-capable SOC supervisory assessment API adhering to SIH 26157 specifications",
    version="1.2.0",
)

# The dashboard is served from the same origin as this API (Nginx proxies
# /api/ to the backend), so no cross-origin access is required in the normal
# deployment. Origins are therefore opt-in through ALLOWED_ORIGINS rather than
# a wildcard: "allow_origins=['*']" combined with credentials is both rejected
# by browsers and an unnecessary exposure on a supervisory enclave.
_allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3010").split(",")
    if origin.strip()
]

# Static hosting (Vercel/Netlify) issues a different origin per deployment and
# per preview branch. When any origin ends with a leading dot it is treated as
# a suffix rule and matched dynamically, so deployments stay open without
# going full wildcard.
_origin_suffixes = [
    s.strip().lower()
    for s in os.getenv("ALLOWED_ORIGIN_SUFFIXES", "").split(",")
    if s.strip()
]


def _origin_allowed(origin: str) -> bool:
    """Exact-match against ALLOWED_ORIGINS, or suffix-match (".vercel.app")
    against the host part of the origin so subdomain previews are covered."""
    from urllib.parse import urlsplit

    o = (origin or "").strip().lower()
    if not o:
        return False
    host = urlsplit(o).hostname or ""
    return (
        o in [x.strip().lower() for x in _allowed_origins]
        or any(host == s.lstrip(".") or host.endswith(s) for s in _origin_suffixes)
    )


class _DynamicOriginCORSMiddleware(CORSMiddleware):
    """CORSMiddleware evaluates allow_origin_regex once at import time; a plain
    callable is not accepted. Subclassing defers the regex decision to request
    time so origin suffixes (e.g. vercel.app previews) work without a restart
    and without allowing every origin."""

    def __init__(self, app: ASGIApp) -> None:
        # Suffixes are matched against the ORIGIN HOST, not the whole URL:
        # ".vercel.app" must accept https://sat-sa.vercel.app (host ends with
        # ".vercel.app") while rejecting "https://evil-vercel.app" (host does
        # not contain a dot before the suffix).
        host_alternatives = "|".join(
            re.escape(s.lstrip(".")) + "$|" + r"[\w-]+" + re.escape(s) + "$"
            for s in _origin_suffixes
        )
        pattern = (
            "^https://(?:" + host_alternatives + ")"
            if _origin_suffixes
            else r"^https://(?!x)x"
        )
        super().__init__(
            app,
            allow_origins=_allowed_origins,
            allow_origin_regex=pattern,
            allow_credentials=True,
            allow_methods=["GET", "POST"],
            allow_headers=["Content-Type", "Authorization"],
        )


app.add_middleware(_DynamicOriginCORSMiddleware)


def _database_dialect() -> str:
    """Report the backend dialect only. The full URL contains credentials and
    must never be returned by an unauthenticated endpoint."""
    return engine.url.get_backend_name()


@app.get("/api/v1/health")
def health_check(db: Session = Depends(get_db)):
    database_reachable = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        database_reachable = False

    return {
        "status": "healthy" if database_reachable else "degraded",
        "service": "SAT-SA FastAPI Backend",
        "version": app.version,
        "database": _database_dialect(),
        "database_reachable": database_reachable,
    }


@app.get("/api/v1/entities", response_model=List[EntityOut])
def get_entities(db: Session = Depends(get_db)):
    return db.query(Entity).all()


@app.get("/api/v1/alerts", response_model=List[AlertOut])
def get_alerts(
    entity_id: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(Alert)
    if entity_id:
        query = query.filter(Alert.entity_id == entity_id)
    return query.limit(max(1, min(limit, 1000))).all()


@app.post("/api/v1/analytics/isolation-forest", response_model=IsolationForestResponse)
def compute_isolation_forest(req: IsolationForestRequest):
    result = run_multivariate_isolation_forest(req.features, contamination=req.contamination)
    return IsolationForestResponse(**result)


# --------------------------------------------------------------------------- AI analyst


class AiChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str


class AiChatRequest(BaseModel):
    """The browser sends the conversation plus the analytics snapshot it is
    looking at; the server owns the system prompt and the model connection."""

    messages: List[AiChatMessage] = Field(min_length=1)
    context: Optional[str] = None  # SAT-SA analytics snapshot text


@app.get("/api/v1/ai/status")
def ai_status():
    """Configuration and live availability of the AI provider.
    Safe to call unauthenticated: it exposes no data, only model metadata."""
    return local_ai.get_status()


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _ai_chat_stream(req: AiChatRequest) -> Iterator[str]:
    """Bridge the configured AI provider stream into Server-Sent Events for the browser.
    Errors are delivered as SSE events (not HTTP failures) so the UI can show
    them inline after the stream has already started."""
    history = [{"role": m.role, "content": m.content} for m in req.messages]
    if req.context:
        # Keep the attached snapshot inside the model's context window (see
        # local_ai._MAX_PROMPT_CHARS): an oversized snapshot slows CPU pre-fill
        # dramatically and gets silently truncated by Ollama anyway.
        history = [
            {"role": "user", "content": f"<analytics_context>\n{local_ai.fit_context(req.context)}\n</analytics_context>\nUse only the figures above when answering."},
            {"role": "assistant", "content": "Understood. I will reason strictly from the provided SAT-SA snapshot."},
        ] + history

    try:
        # Immediate acknowledgement: on CPU the first token can take minutes
        # (prompt pre-fill), and without this the UI looks frozen.
        yield _sse("status", {"message": "Model is reading the snapshot… first tokens take a while on CPU."})
        for delta in local_ai.stream_chat(history):
            yield _sse("delta", {"text": delta})
        yield _sse("done", {})
    except local_ai.OllamaUnavailable as exc:
        yield _sse("error", {"message": str(exc)})
        yield _sse("done", {})


@app.post("/api/v1/ai/chat")
def ai_chat(req: AiChatRequest):
    """Streaming chat against the AI provider model (SSE)."""
    return StreamingResponse(
        _ai_chat_stream(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn  # pragma: no cover

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
