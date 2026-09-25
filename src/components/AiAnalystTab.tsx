import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Bot,
  Send,
  Square,
  Sparkles,
  AlertTriangle,
  PlugZap,
  RotateCcw,
  Check,
  CircleSlash,
} from 'lucide-react';
import {
  AiStatus,
  AiChatTurn,
  fetchAiStatus,
  fetchBackendUp,
  buildAnalyticsSnapshot,
  streamAiChat,
} from '../engine/aiClient';
import { EntityRiskScore, FindingRecord, ReviewQueueItem, DataQualityReport } from '../types';
import { Badge, Panel, PageHeader, Callout } from './ui';

interface AiAnalystTabProps {
  runId: string;
  datasetHash: string;
  entityScores: EntityRiskScore[];
  findings: FindingRecord[];
  reviewQueue: ReviewQueueItem[];
  dataQuality: DataQualityReport;
}

interface ChatMessage extends AiChatTurn {
  id: number;
  error?: boolean;
  /** Transient pre-first-token note ("reading the snapshot…"). Never part of
   * the answer text: the first delta clears it so it can never get glued to
   * the start of the reply. */
  pendingNote?: string;
}

type ProbeState =
  | { phase: 'probing' }
  | { phase: 'up'; status: AiStatus }
  | { phase: 'down' };

const PRESETS: { label: string; prompt: string }[] = [
  {
    label: 'Summarize the current assessment',
    prompt:
      'Summarize this assessment for the sectoral supervisor: which entities need attention first and why, in 6 bullet points maximum.',
  },
  {
    label: 'Rank the top 3 highest-priority review items',
    prompt:
      'From the review queue, identify the 3 items that should be examined first. For each, cite its priority score and the evidence in the snapshot.',
  },
  {
    label: 'Explain why an entity ranks where it does',
    prompt:
      'Explain the risk composition of the highest-ranked entity: which component score drives its band, and what data backs it.',
  },
  {
    label: 'What should we validate next?',
    prompt:
      'Based on the findings and data-quality issues, recommend the next 3 validation steps an examiner should take.',
  },
  {
    label: 'Draft a supervisor briefing note',
    prompt:
      'Draft a short supervisor briefing: overall posture, the two most concerning signals, and one recommended action. Keep it under 120 words.',
  },
];

/**
 * AI analyst powered by a backend-hosted AI provider; the browser never sees the provider key.
 * Everything here degrades gracefully: no backend → offline banner; backend
 * up but model disabled → setup guidance; model enabled → streaming chat that
 * reasons strictly over the analytics snapshot currently on screen.
 */
export const AiAnalystTab: React.FC<AiAnalystTabProps> = ({
  runId,
  datasetHash,
  entityScores,
  findings,
  reviewQueue,
  dataQuality,
}) => {
  const [probe, setProbe] = useState<ProbeState>({ phase: 'probing' });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [withContext, setWithContext] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(1);

  const snapshot = useMemo(
    () =>
      buildAnalyticsSnapshot({ runId, datasetHash, entityScores, findings, reviewQueue, dataQuality }),
    [runId, datasetHash, entityScores, findings, reviewQueue, dataQuality],
  );

  const probeAi = useCallback(async () => {
    setProbe({ phase: 'probing' });
    const up = await fetchBackendUp();
    if (!up) {
      setProbe({ phase: 'down' });
      return;
    }
    try {
      const status = await fetchAiStatus();
      setProbe({ phase: 'up', status });
    } catch {
      setProbe({ phase: 'down' });
    }
  }, []);

  useEffect(() => {
    void probeAi();
  }, [probeAi]);

  // Keep the newest message visible while tokens stream in.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      if (probe.phase !== 'up') return;

      const userMsg: ChatMessage = { id: nextId.current++, role: 'user', content: trimmed };
      const assistantId = nextId.current++;
      setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);
      setInput('');
      setStreaming(true);

      const history: AiChatTurn[] = [
        ...messages.map(({ role, content }) => ({ role, content })),
        { role: 'user', content: trimmed },
      ];

      const controller = new AbortController();
      abortRef.current = controller;

      const patch = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));

      await streamAiChat(
        {
          messages: history,
          context: withContext ? snapshot : undefined,
        },
        {
          onDelta: (delta) =>
            patch((m) => ({ ...m, content: m.content + delta, pendingNote: undefined })),
          onStatus: (message) => patch((m) => ({ ...m, pendingNote: message })),
          onDone: () => undefined,
          onError: (message) => patch((m) => ({ ...m, content: m.content || message, error: true })),
        },
        controller.signal,
      );

      setStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    },
    [messages, snapshot, streaming, withContext, probe],
  );

  const stop = () => {
    abortRef.current?.abort();
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput('');
  };

  const canChat = probe.phase === 'up' && probe.status.configured && !streaming;

  /* --------------------------------------------------------------- banner */

  const renderBanner = () => {
    if (probe.phase === 'probing') {
      return (
        <Callout tone="info" icon={<PlugZap size={15} />}>
          Probing the backend for a local model runtime…
        </Callout>
      );
    }
    if (probe.phase === 'down') {
      return (
        <Callout tone="warn" icon={<AlertTriangle size={15} />} title="AI analyst offline — backend not reachable">
          The model runs through the SAT-SA backend, which is not answering at <code>/api/v1/health</code>.
          Start it with <code>uvicorn backend.main:app --port 8001</code> (or <code>docker compose up backend</code>),
          then retry. The rest of this console works without it.
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-sm btn-outline" onClick={() => void probeAi()}>
              <RotateCcw size={12} /> Retry
            </button>
          </div>
        </Callout>
      );
    }
    const { status } = probe;
    if (!status.configured) {
      return (
        <Callout tone="info" icon={<PlugZap size={15} />} title="AI provider not enabled on the backend">
          <div className="stack" style={{ gap: 8 }}>
            <span>
              The backend is reachable but the AI provider is not configured. For the free online deployment,
              add a GROQ_API_KEY to the backend environment and keep AI_PROVIDER=groq:
            </span>
            <pre className="chat-code">{`# Free online AI deployment
AI_PROVIDER=groq
AI_ENABLED=true
GROQ_API_KEY=your_key_here
GROQ_MODEL=openai/gpt-oss-20b`}</pre>
            <span className="text-xs dim">
              Models detected: {status.models.length ? status.models.map((m) => m.name).join(', ') : 'none yet'}
            </span>
            <div>
              <button className="btn btn-sm btn-outline" onClick={() => void probeAi()}>
                <RotateCcw size={12} /> Re-check
              </button>
            </div>
          </div>
        </Callout>
      );
    }
    if (!status.reachable) {
      return (
        <Callout tone="warn" icon={<AlertTriangle size={15} />} title="Model runtime not responding">
          The configured AI provider is enabled but not responding at <code>{status.host}</code>. Check the backend environment and API key, then retry.
          {status.error ? <div className="text-xs dim" style={{ marginTop: 4 }}>{status.error}</div> : null}
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-sm btn-outline" onClick={() => void probeAi()}>
              <RotateCcw size={12} /> Re-check
            </button>
          </div>
        </Callout>
      );
    }
    if (!status.default_model_ready) {
      return (
        <Callout tone="info" icon={<PlugZap size={15} />} title="AI model not available">
          The configured AI provider is reachable but the selected model is not available.
          Set <code>GROQ_MODEL</code> to an available model shown below and retry.
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-sm btn-outline" onClick={() => void probeAi()}>
              <RotateCcw size={12} /> Re-check
            </button>
          </div>
        </Callout>
      );
    }
    return null;
  };

  const banner = renderBanner();

  /* --------------------------------------------------------------- render */

  return (
    <div className="stack">
      <PageHeader
        eyebrow="AI analyst · backend-proxied"
        title="AI analyst"
        description="The SAT-SA backend securely proxies AI requests. In the free deployment, the Analyst uses a free cloud AI tier; your API key stays on the backend."
        actions={
          <Badge tone={canChat ? 'low' : 'neutral'} mono>
            {probe.phase === 'up' && probe.status.configured
              ? probe.status.model
              : probe.phase === 'probing'
                ? 'checking…'
                : 'offline'}
          </Badge>
        }
      />

      {banner}

      <Panel
        title="Analyst session"
        note={
          probe.phase === 'up' && probe.status.configured
            ? `Reasoning over run ${runId} — snapshot ${withContext ? 'attached' : 'detached'}`
            : 'Unavailable until a model is configured'
        }
        actions={
          <>
            <label className="row text-xs" style={{ gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={withContext}
                onChange={(e) => setWithContext(e.target.checked)}
                disabled={streaming}
                name="ai_context_toggle"
              />
              Attach analytics snapshot
            </label>
            {messages.length > 0 && (
              <button className="btn btn-sm btn-outline" onClick={reset} disabled={streaming}>
                <RotateCcw size={12} /> New session
              </button>
            )}
          </>
        }
        bodyClassName="panel-body chat-body"
      >
        <div className="chat-list" ref={listRef} aria-live="polite">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <Bot size={26} aria-hidden="true" />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--fg)' }}>Ask about this assessment</div>
                <div className="text-xs dim" style={{ marginTop: 2 }}>
                  The assistant sees only the snapshot attached below — nothing else is sent to the model.
                </div>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`chat-msg chat-${m.role}${m.error ? ' chat-error' : ''}`}>
                <div className="chat-who">
                  {m.role === 'user' ? (
                    'You'
                  ) : (
                    <>
                      <Sparkles size={11} aria-hidden="true" /> Analyst
                    </>
                  )}
                </div>
                <div
                  className="chat-text"
                  style={streaming && m.pendingNote && !m.content ? { opacity: 0.65 } : undefined}
                >
                  {m.content || (streaming ? (m.pendingNote ?? '…') : '')}
                </div>
              </div>
            ))
          )}
        </div>

        {messages.length === 0 && (
          <div className="chat-presets">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className="chat-preset"
                onClick={() => void send(p.prompt)}
                disabled={!canChat}
                title={p.prompt}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <textarea
            ref={inputRef}
            className="input chat-input"
            value={input}
            name="ai_prompt"
            rows={2}
            placeholder={
              canChat
                ? 'Ask about entities, findings, queue prioritisation…'
                : 'Configure a local model to enable the analyst'
            }
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            disabled={probe.phase !== 'up' || !probe.status.configured}
            aria-label="Message to the AI analyst"
          />
          {streaming ? (
            <button type="button" className="btn btn-danger" onClick={stop} aria-label="Stop generating">
              <Square size={13} /> Stop
            </button>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={!canChat || !input.trim()}>
              <Send size={13} /> Send
            </button>
          )}
        </form>

        <details className="chat-context">
          <summary>
            Analytics snapshot {withContext ? 'attached to' : 'excluded from'} every prompt
          </summary>
          <pre className="chat-code">{snapshot}</pre>
          <div className="text-xs dim" style={{ marginTop: 6 }}>
            {withContext ? (
              <>
                <Check size={11} style={{ verticalAlign: -1 }} /> The model is instructed to reason only from
                these figures. Detach it to ask general questions.
              </>
            ) : (
              <>
                <CircleSlash size={11} style={{ verticalAlign: -1 }} /> Detached — the model has no analytics
                context until you re-attach it.
              </>
            )}
          </div>
        </details>
      </Panel>
    </div>
  );
};
