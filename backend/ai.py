"""SAT-SA AI bridge.

Production-free deployment uses Groq's OpenAI-compatible API through the backend,
so the browser never sees the API key. Local Ollama remains supported by setting
AI_PROVIDER=ollama for on-machine Docker deployments.
"""
from __future__ import annotations

import http.client
import json
import os
import socket
from typing import Any, Dict, Iterator, List, Optional
from urllib.parse import urlsplit

AI_PROVIDER = os.getenv("AI_PROVIDER", "groq").strip().lower()
AI_ENABLED = os.getenv("AI_ENABLED", "true").lower() in ("1", "true", "yes", "on")

# Groq (production-free deployment)
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_BASE_URL = os.getenv(
    "GROQ_BASE_URL",
    "https://api.groq.com/openai/v1"
).rstrip("/")

# Current production model on Groq.
# Older/local Ollama-style values such as ``llama3.2:3b`` are not valid Groq
# model IDs; map that legacy value to the current Groq model so an old .env
# does not break the Analyst.
GROQ_MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-20b"
).strip() or "openai/gpt-oss-20b"

if GROQ_MODEL in {"llama3.2:3b", "llama3.2-3b-preview"}:
    GROQ_MODEL = "openai/gpt-oss-20b"

GROQ_TIMEOUT = float(os.getenv("GROQ_TIMEOUT", "120"))

# Ollama (local development / Docker)
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
OLLAMA_ENABLED = os.getenv(
    "OLLAMA_ENABLED",
    "false"
).lower() in ("1", "true", "yes", "on")
OLLAMA_CONNECT_TIMEOUT = float(os.getenv("OLLAMA_CONNECT_TIMEOUT", "10"))
OLLAMA_GENERATION_TIMEOUT = float(os.getenv("OLLAMA_GENERATION_TIMEOUT", "300"))
OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "30m")
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "2048"))
OLLAMA_NUM_THREADS = int(os.getenv("OLLAMA_NUM_THREADS", "0"))

_SYSTEM_PROMPT = """You are a senior SOC analyst reviewing SAT-SA supervisory analytics for India's \
critical sector entities (SIH 26157, NTRO/NCIIPC). A colleague sent you the snapshot below and \
asked you a question. Respond like a knowledgeable colleague talking to another analyst: analyse, \
explain your reasoning in plain prose, and give a bottom line. Never dump rows or repeat the \
snapshot verbatim — the reader already has it.

How the scoring works (use this, do not guess):
- composite = 0.40×execution_gap + 0.35×negative_space + 0.15×trend_deterioration + 0.10×peer_deviation.
- execution_gap: controls look nominal on paper but triage was superficial — alerts closed fast \
without matching investigation depth.
- negative_space: expected evidence is MISSING entirely — assets or events that should appear in \
the submission but don't.
- trend_deterioration: scores worsening across reporting periods. peer_deviation: unexplained \
variation vs peer entities in the same sector.
- Bands: Very High ≥75, High ≥50, Moderate ≥25, else Low.

Rules of evidence:
- Cite only figures present in the snapshot. If a needed figure is absent, say what you would \
need and why — do not invent names, fields, or numbers.
- Show the arithmetic when you attribute a band.
- Distinguish clearly between what the data shows and what you infer from it.
- Keep it conversational but precise; a few short paragraphs at most unless asked for more."""

_MAX_PROMPT_CHARS = 12000


class AiUnavailable(RuntimeError):
    pass


class AiTimeout(AiUnavailable):
    pass


# Backward-compatible names used elsewhere in the app.
OllamaUnavailable = AiUnavailable
OllamaTimeout = AiTimeout


def _parse_host(host: str, default_port: int) -> tuple[str, int, str, bool]:
    if "://" not in host:
        host = "https://" + host

    parts = urlsplit(host)

    return (
        parts.hostname or "127.0.0.1",
        parts.port or default_port,
        f"{parts.scheme}://{parts.hostname or '127.0.0.1'}:{parts.port or default_port}",
        parts.scheme == "https",
    )


def _http_request(
    base_url: str,
    path: str,
    *,
    method: str = "GET",
    body: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
    stream: bool = False,
    timeout: float = 120,
) -> Any:
    parts = urlsplit(base_url)

    host = parts.hostname or "127.0.0.1"
    port = parts.port or (443 if parts.scheme == "https" else 80)

    Conn = (
        http.client.HTTPSConnection
        if parts.scheme == "https"
        else http.client.HTTPConnection
    )

    conn = Conn(host, port, timeout=timeout)

    # Preserve the path contained in the base URL.
    #
    # Example:
    # base_url = https://api.groq.com/openai/v1
    # path     = /models
    #
    # Result:
    # /openai/v1/models
    base_path = parts.path.rstrip("/")
    request_path = f"{base_path}/{path.lstrip('/')}"

    payload = json.dumps(body).encode("utf-8") if body is not None else None

    hdrs = {
        "Content-Type": "application/json",
        **(headers or {}),
    }

    try:
        conn.request(
            method,
            request_path,
            body=payload,
            headers=hdrs,
        )

        resp = conn.getresponse()

    except socket.timeout as exc:
        conn.close()
        raise AiTimeout(
            f"AI provider did not respond within {timeout:.0f}s."
        ) from exc

    except (OSError, http.client.HTTPException) as exc:
        conn.close()
        raise AiUnavailable(
            f"AI provider is unreachable: {exc}"
        ) from exc

    if resp.status >= 400:
        detail = resp.read(3000).decode("utf-8", "replace")
        conn.close()

        raise AiUnavailable(
            f"AI provider returned HTTP {resp.status}: {detail}"
        )

    if stream:
        return resp, conn

    try:
        data = json.loads(
            resp.read().decode("utf-8")
        )
    finally:
        conn.close()

    return data


def fit_context(
    context: str,
    max_chars: int = _MAX_PROMPT_CHARS,
) -> str:
    if len(context) <= max_chars:
        return context

    head = max_chars * 3 // 4
    tail = max_chars - head - 60

    return (
        context[:head]
        + "\n… [snapshot truncated] …\n"
        + context[-tail:]
    )


def _groq_configured() -> bool:
    return (
        AI_ENABLED
        and AI_PROVIDER == "groq"
        and bool(GROQ_API_KEY)
    )


def _ollama_configured() -> bool:
    return (
        AI_ENABLED
        and AI_PROVIDER == "ollama"
        and OLLAMA_ENABLED
    )


def get_status() -> Dict[str, Any]:
    if AI_PROVIDER == "groq":
        configured = _groq_configured()
        reachable = False
        models: List[Dict[str, Any]] = []
        error: Optional[str] = None

        if configured:
            try:
                data = _http_request(
                    GROQ_BASE_URL,
                    "/models",
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}"
                    },
                    timeout=20,
                )

                reachable = True

                for m in data.get("data", []) or []:
                    mid = m.get("id") or "?"

                    models.append(
                        {
                            "name": mid,
                            "size_bytes": None,
                            "parameter_size": None,
                            "quantization": None,
                        }
                    )

            except AiUnavailable as exc:
                error = str(exc)

        default_ready = any(
            m["name"] == GROQ_MODEL
            for m in models
        )

        return {
            "configured": configured,
            "reachable": reachable,
            "host": "https://api.groq.com",
            "model": GROQ_MODEL,
            "default_model_ready": default_ready,
            "models": models,
            "error": error,
        }

    if AI_PROVIDER == "ollama":
        configured = _ollama_configured()
        base = _parse_host(
            OLLAMA_HOST,
            11434
        )[2]

        reachable = False
        models: List[Dict[str, Any]] = []
        error: Optional[str] = None

        if configured:
            try:
                data = _http_request(
                    OLLAMA_HOST,
                    "/api/tags",
                    timeout=OLLAMA_CONNECT_TIMEOUT,
                )

                reachable = True

                for m in data.get("models", []) or []:
                    models.append(
                        {
                            "name": m.get("name")
                            or m.get("model")
                            or "?",
                            "size_bytes": m.get("size"),
                            "parameter_size": (
                                m.get("details") or {}
                            ).get("parameter_size"),
                            "quantization": (
                                m.get("details") or {}
                            ).get("quantization_level"),
                        }
                    )

            except AiUnavailable as exc:
                error = str(exc)

        default_ready = any(
            m["name"] == OLLAMA_MODEL
            for m in models
        )

        return {
            "configured": configured,
            "reachable": reachable,
            "host": base if configured else None,
            "model": OLLAMA_MODEL,
            "default_model_ready": default_ready,
            "models": models,
            "error": error,
        }

    return {
        "configured": False,
        "reachable": False,
        "host": None,
        "model": None,
        "default_model_ready": False,
        "models": [],
        "error": (
            f"Unsupported AI_PROVIDER={AI_PROVIDER!r}. "
            "Use groq or ollama."
        ),
    }


def _stream_groq(
    messages: List[Dict[str, str]]
) -> Iterator[str]:

    body = {
        "model": GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": _SYSTEM_PROMPT,
            },
            *messages,
        ],
        "temperature": 0.2,
        "stream": True,
    }

    resp, conn = _http_request(
        GROQ_BASE_URL,
        "/chat/completions",
        method="POST",
        body=body,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}"
        },
        stream=True,
        timeout=GROQ_TIMEOUT,
    )

    try:
        buffer = ""

        for chunk in iter(
            lambda: resp.read(4096),
            b"",
        ):
            if not chunk:
                break

            buffer += chunk.decode(
                "utf-8",
                "replace",
            )

            while "\n" in buffer:
                line, buffer = buffer.split(
                    "\n",
                    1,
                )

                line = line.strip()

                if not line.startswith("data:"):
                    continue

                data = line[5:].strip()

                if data == "[DONE]":
                    return

                try:
                    event = json.loads(data)
                except json.JSONDecodeError:
                    continue

                if event.get("error"):
                    raise AiUnavailable(
                        str(event["error"])
                    )

                choices = event.get("choices") or []

                if not choices:
                    continue

                piece = (
                    (
                        choices[0].get("delta")
                        or {}
                    ).get("content")
                    or ""
                )

                if piece:
                    yield piece

        if buffer.strip().startswith("data:"):
            data = buffer.strip()[5:].strip()

            if data and data != "[DONE]":
                try:
                    event = json.loads(data)

                    piece = (
                        (
                            (
                                event.get("choices")
                                or [{}]
                            )[0].get("delta")
                            or {}
                        ).get("content")
                        or ""
                    )

                    if piece:
                        yield piece

                except json.JSONDecodeError:
                    pass

    except socket.timeout as exc:
        raise AiTimeout(
            f"AI generation exceeded {GROQ_TIMEOUT:.0f}s."
        ) from exc

    finally:
        try:
            resp.close()
        finally:
            conn.close()


def _stream_ollama(
    messages: List[Dict[str, str]]
) -> Iterator[str]:

    options: Dict[str, Any] = {
        "temperature": 0.2,
        "num_ctx": OLLAMA_NUM_CTX,
    }

    if OLLAMA_NUM_THREADS > 0:
        options["num_thread"] = OLLAMA_NUM_THREADS

    body = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": True,
        "keep_alive": OLLAMA_KEEP_ALIVE,
        "options": options,
    }

    resp, conn = _http_request(
        OLLAMA_HOST,
        "/api/chat",
        method="POST",
        body=body,
        stream=True,
        timeout=OLLAMA_GENERATION_TIMEOUT,
    )

    try:
        for raw_line in resp:
            line = raw_line.strip()

            if not line:
                continue

            try:
                event = json.loads(
                    line.decode("utf-8")
                )
            except (
                json.JSONDecodeError,
                UnicodeDecodeError,
            ):
                continue

            if event.get("error"):
                raise AiUnavailable(
                    str(event["error"])
                )

            piece = (
                event.get("message") or {}
            ).get("content", "")

            if piece:
                yield piece

            if event.get("done"):
                return

    except socket.timeout as exc:
        raise AiTimeout(
            f"Ollama generation exceeded "
            f"{OLLAMA_GENERATION_TIMEOUT:.0f}s."
        ) from exc

    finally:
        try:
            resp.close()
        finally:
            conn.close()


def stream_chat(
    messages: List[Dict[str, str]]
) -> Iterator[str]:

    if not messages:
        raise AiUnavailable(
            "No messages provided."
        )

    if AI_PROVIDER == "groq":
        if not _groq_configured():
            raise AiUnavailable(
                "Groq AI is not configured. "
                "Add GROQ_API_KEY to the backend environment."
            )

        yield from _stream_groq(messages)
        return

    if AI_PROVIDER == "ollama":
        if not _ollama_configured():
            raise AiUnavailable(
                "Ollama AI is not configured."
            )

        # System prompt is injected here too for local mode.
        yield from _stream_ollama(
            [
                {
                    "role": "system",
                    "content": _SYSTEM_PROMPT,
                },
                *messages,
            ]
        )
        return

    raise AiUnavailable(
        f"Unsupported AI_PROVIDER={AI_PROVIDER!r}."
    )


def summarize_findings_context(
    payload: Dict[str, Any],
    max_chars: int = _MAX_PROMPT_CHARS,
) -> str:

    lines: List[str] = [
        "SAT-SA ANALYTICS SNAPSHOT"
    ]

    counts = payload.get("record_counts") or {}

    if counts:
        lines.append(
            "Dataset: "
            + ", ".join(
                f"{k}={v}"
                for k, v in counts.items()
                if isinstance(v, int)
            )
        )

    if payload.get("run_id"):
        lines.append(
            f"Run: {payload['run_id']}"
        )

    if payload.get("dataset_hash"):
        lines.append(
            f"Dataset SHA-256: "
            f"{payload['dataset_hash']}"
        )

    scores = payload.get("entity_scores") or []

    if scores:
        lines += [
            "",
            "ENTITY RISK SCORES:",
        ]

        for s in scores:
            lines.append(
                f"- #{s.get('rank')} "
                f"{s.get('entity_name')} "
                f"[{s.get('sector')}] "
                f"band={s.get('prioritization_band')} "
                f"composite={s.get('overall_risk_score')} "
                f"exec={s.get('execution_gap_score')} "
                f"neg={s.get('negative_space_score')} "
                f"trend={s.get('trend_deterioration_score')} "
                f"peer={s.get('unexplained_peer_deviation_score')}"
            )

    findings = payload.get("findings") or []

    if findings:
        lines += [
            "",
            f"FINDINGS ({len(findings)}):",
        ]

        for f in findings:
            lines.append(
                f"- {f.get('finding_id')} "
                f"[{f.get('severity')}] "
                f"{f.get('entity_id')} "
                f"rule={f.get('rule_id')} "
                f"score={f.get('score')} "
                f"class={f.get('finding_class')}: "
                f"{f.get('rationale')}"
            )

    queue = payload.get("review_queue") or []

    if queue:
        lines += [
            "",
            f"REVIEW QUEUE ({len(queue)} open items):",
        ]

        for q in queue:
            d = q.get("details") or {}

            lines.append(
                f"- {q.get('queue_item_id')} "
                f"[{q.get('priority_band')}] "
                f"{q.get('entity_name')} "
                f"priority={q.get('priority_score')} "
                f"status={q.get('review_status')} "
                f"escalated={d.get('is_escalated')} "
                f"evidence={q.get('evidence_summary')}"
            )

    dq = payload.get("data_quality") or {}

    if dq:
        lines += [
            "",
            f"DATA QUALITY: "
            f"overall={dq.get('overall_score')}, "
            f"duplicates={dq.get('duplicate_ids_count')}, "
            f"missing_timestamps={dq.get('missing_timestamps_count')}, "
            f"orphans={dq.get('orphan_cases_count', 0) + dq.get('orphan_escalations_count', 0)}, "
            f"rejected={dq.get('rejected_records_count')}",
        ]

        for issue in (
            dq.get("issues") or []
        )[:12]:
            lines.append(
                f"  * [{issue.get('severity')}] "
                f"{issue.get('rule_name')}: "
                f"{issue.get('description')}"
            )

    return fit_context(
        "\n".join(lines),
        max_chars,
    )