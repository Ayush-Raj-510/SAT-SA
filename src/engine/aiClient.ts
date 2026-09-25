/**
 * SAT-SA AI analyst client.
 *
 * The browser never talks to the model runtime directly: it calls the backend
 * (`/api/v1/ai/*`), which owns the Ollama connection and the system prompt.
 * All endpoints are optional at runtime — every failure mode degrades to a
 * usable offline state instead of breaking the console.
 */

import {
  DataQualityReport,
  FindingRecord,
  ReviewQueueItem,
  EntityRiskScore,
} from '../types';
import { formatTimestamp } from './format';

export interface AiModelInfo {
  name: string;
  size_bytes?: number | null;
  parameter_size?: string | null;
  quantization?: string | null;
}

export interface AiStatus {
  configured: boolean;
  reachable: boolean;
  host: string | null;
  model: string | null;
  default_model_ready: boolean;
  models: AiModelInfo[];
  error: string | null;
}

export interface AiChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

// Same-origin by default (nginx/Docker/vite-proxy deployments, and Vercel
// when vercel.json rewrites /api/* to the backend origin). For static hosts
// without a rewrite proxy, set VITE_API_ORIGIN to the backend origin at
// build time instead.
const API_BASE = `${import.meta.env.VITE_API_ORIGIN ?? ''}/api/v1`;

/** Lightweight reachability probe for the backend itself. */
export async function fetchBackendUp(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchAiStatus(signal?: AbortSignal): Promise<AiStatus> {
  const res = await fetch(`${API_BASE}/ai/status`, { signal });
  if (!res.ok) throw new Error(`AI status failed: HTTP ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------- analytics snapshot */

const clampText = (s: string | undefined | null, n: number) => {
  const v = (s ?? '').replace(/\s+/g, ' ').trim();
  return v.length > n ? `${v.slice(0, n - 1)}…` : v;
};

/**
 * Render the exact analytics state on screen into a compact text snapshot the
 * model can reason over. Deliberately deterministic (no sampling, no rounding
 * surprises) because examiners may quote it in a supervisory record.
 */
export function buildAnalyticsSnapshot(args: {
  runId: string;
  datasetHash: string;
  entityScores: EntityRiskScore[];
  findings: FindingRecord[];
  reviewQueue: ReviewQueueItem[];
  dataQuality: DataQualityReport;
}): string {
  const { runId, datasetHash, entityScores, findings, reviewQueue, dataQuality } = args;
  // Row caps keep the snapshot TINY on purpose: CPU pre-fill costs ~50ms per
  // token, so every row is literal seconds before the first word appears.
  // The full data stays in the dashboard tables; the model only gets the
  // top-ranked slice it can actually reason over in a 2k-token window.
  const MAX_ENTITIES = 12;
  const MAX_FINDINGS = 12;
  const MAX_QUEUE = 10;
  const openQueue = reviewQueue.filter((q) => q.review_status === 'Pending');
  const lines: string[] = ['SAT-SA ANALYTICS SNAPSHOT'];
  lines.push(
    `Run: ${runId} · Dataset SHA-256: ${datasetHash} · Generated: ${formatTimestamp(new Date().toISOString())}`,
  );
  lines.push(
    `Records: entities=${entityScores.length} findings=${findings.length} queue_items=${reviewQueue.length}` +
      ` (snapshot lists the top ${Math.min(entityScores.length, MAX_ENTITIES)}/${Math.min(findings.length, MAX_FINDINGS)}/${Math.min(openQueue.length, MAX_QUEUE)})`,
  );

  if (entityScores.length) {
    lines.push('');
    lines.push(
      'ENTITY RISK SCORES (rank, entity, sector, band, composite, exec, neg, trend, peer, data_quality):',
    );
    for (const s of entityScores.slice(0, MAX_ENTITIES)) {
      lines.push(
        `- #${s.rank} ${s.entity_name} (${s.entity_id}) [${s.sector}] band=${s.prioritization_band} ` +
          `composite=${s.overall_risk_score} exec=${s.execution_gap_score} neg=${s.negative_space_score} ` +
          `trend=${s.trend_deterioration_score} peer=${s.unexplained_peer_deviation_score} dq=${s.data_quality_score} ` +
          `confidence=${s.confidence_label}`,
      );
    }
  }

  if (findings.length) {
    lines.push('');
    lines.push(`FINDINGS (${findings.length}):`);
    for (const f of findings.slice(0, MAX_FINDINGS)) {
      lines.push(
        `- ${f.finding_id} [${f.severity}] ${f.entity_id} rule=${f.rule_id} score=${f.score} ` +
          `class=${f.finding_class}: ${clampText(f.rationale, 90)}`,
      );
    }
  }

  if (openQueue.length) {
    lines.push('');
    lines.push(`REVIEW QUEUE (${openQueue.length} pending of ${reviewQueue.length}):`);
    for (const q of openQueue.slice(0, MAX_QUEUE)) {
      lines.push(
        `- ${q.queue_item_id} [${q.priority_band}] ${q.entity_name} (${q.entity_id}) ` +
          `priority=${q.priority_score} evidence=${clampText(q.evidence_summary, 70)}`,
      );
    }
  }

  lines.push('');
  lines.push(
    `DATA QUALITY: overall=${dataQuality.overall_score} rejected=${dataQuality.rejected_records_count} ` +
      `duplicates=${dataQuality.duplicate_ids_count} missing_ts=${dataQuality.missing_timestamps_count} ` +
      `orphans=${dataQuality.orphan_cases_count + dataQuality.orphan_escalations_count}`,
  );
  for (const issue of dataQuality.issues.slice(0, 12)) {
    lines.push(`  * [${issue.severity}] ${issue.rule_name}: ${clampText(issue.description, 140)}`);
  }

  lines.push('');
  lines.push('SCORING LEGEND:');
  lines.push('- composite = 0.40*exec + 0.35*neg + 0.15*trend + 0.10*peer; bands: Very High >=75, High >=50, Moderate >=25, else Low.');
  lines.push('- exec (execution_gap): controls nominal on paper but triage superficial — alerts closed without matching investigation depth.');
  lines.push('- neg (negative_space): expected evidence missing entirely from the submission.');
  lines.push('- trend: worsening across periods. peer: unexplained deviation vs sector peers.');

  return lines.join('\n');
}

/* ------------------------------------------------------------- chat stream */

export interface StreamChatCallbacks {
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
  /** Progress notes before the first token (e.g. "reading the snapshot…"). */
  onStatus?: (message: string) => void;
}

/**
 * POST to the streaming chat endpoint and parse the Server-Sent Events
 * response incrementally. `onDelta` fires per token-chunk, so the answer
 * renders as it is generated.
 */
export async function streamAiChat(
  body: { messages: AiChatTurn[]; context?: string },
  callbacks: StreamChatCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    callbacks.onError(
      err instanceof DOMException && err.name === 'AbortError'
        ? 'Request cancelled.'
        : 'Backend not reachable. Start the backend (uvicorn backend.main:app) to use the AI analyst.',
    );
    return;
  }

  if (!res.ok || !res.body) {
    callbacks.onError(`AI chat failed: HTTP ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let errored = false;
  let finished = false;

  const handleEvent = (raw: string) => {
    const lines = raw.split('\n');
    let event = 'message';
    let data = '';
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return;
    let parsed: { text?: string; message?: string };
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    if (event === 'delta' && typeof parsed.text === 'string') {
      callbacks.onDelta(parsed.text);
    } else if (event === 'status' && typeof parsed.message === 'string') {
      callbacks.onStatus?.(parsed.message);
    } else if (event === 'error') {
      errored = true;
      callbacks.onError(parsed.message ?? 'The local model returned an error.');
    } else if (event === 'done') {
      finished = true;
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        handleEvent(raw);
      }
    }
    if (buffer.trim()) handleEvent(buffer);
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      errored = true;
      callbacks.onError('Connection to the backend dropped mid-answer.');
    }
  } finally {
    reader.releaseLock();
  }

  if (!errored && !finished) {
    callbacks.onError('The stream ended before the answer completed.');
  } else if (!errored) {
    callbacks.onDone();
  }
}
