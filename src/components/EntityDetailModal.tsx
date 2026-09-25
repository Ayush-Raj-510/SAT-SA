import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  EntityRiskScore,
  FindingRecord,
  PeerBenchmarkMetric,
  AssetRecord,
  ReviewQueueItem,
} from '../types';
import { Modal, Panel, Badge, EmptyState, Meter, severityTone, bandTone, statusTone } from './ui';
import { formatScore } from '../engine/format';

interface EntityDetailModalProps {
  entityId: string | null;
  onClose: () => void;
  entityScore?: EntityRiskScore;
  findings: FindingRecord[];
  peerMetrics?: PeerBenchmarkMetric[];
  assets: AssetRecord[];
  reviewQueue: ReviewQueueItem[];
  onSelectReviewItem?: (item: ReviewQueueItem) => void;
}

type SubTab = 'overview' | 'findings' | 'peer' | 'assets' | 'queue';

const WEIGHTS: { key: keyof EntityRiskScore; label: string; weight: number }[] = [
  { key: 'execution_gap_score', label: 'Execution gap', weight: 0.4 },
  { key: 'negative_space_score', label: 'Negative space', weight: 0.35 },
  { key: 'trend_deterioration_score', label: 'Trend deterioration', weight: 0.15 },
  { key: 'unexplained_peer_deviation_score', label: 'Peer deviation', weight: 0.1 },
];

export const EntityDetailModal: React.FC<EntityDetailModalProps> = ({
  entityId,
  onClose,
  entityScore,
  findings,
  peerMetrics = [],
  assets,
  reviewQueue,
  onSelectReviewItem,
}) => {
  // Hooks must run on every render, so this state is declared before any early
  // return. Declaring it after the guard breaks the hook order as soon as the
  // component is mounted with data and then rendered without it.
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('overview');

  if (!entityId || !entityScore) return null;

  const entityFindings = findings.filter((f) => f.entity_id === entityId);
  const entityAssets = assets.filter((a) => a.entity_id === entityId);
  const entityQueue = reviewQueue.filter((q) => q.entity_id === entityId);

  const tabs: { id: SubTab; label: string }[] = [
    { id: 'overview', label: 'Score decomposition' },
    { id: 'findings', label: `Findings (${entityFindings.length})` },
    { id: 'peer', label: `Peer benchmarks (${peerMetrics.length})` },
    { id: 'assets', label: `Asset visibility (${entityAssets.length})` },
    { id: 'queue', label: `Review items (${entityQueue.length})` },
  ];

  const closureLabel =
    entityScore.median_closure_time_seconds < 60
      ? `${entityScore.median_closure_time_seconds}s`
      : `${Math.round(entityScore.median_closure_time_seconds / 60)} min`;

  return (
    <Modal
      title={entityScore.entity_name}
      subtitle={
        <>
          <span className="mono">{entityScore.entity_id}</span> · {entityScore.sector} ·{' '}
          {entityScore.peer_group} · period {entityScore.reporting_period}
        </>
      }
      onClose={onClose}
      width={1020}
      actions={
        <>
          <Badge tone={bandTone(entityScore.prioritization_band)}>
            {entityScore.prioritization_band} attention
          </Badge>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)' }}>
            {entityScore.overall_risk_score}
            <span className="text-xs dim">/100</span>
          </span>
        </>
      }
      footer={<span>Rank #{entityScore.rank} · data quality {entityScore.data_quality_score}/100 · {entityScore.confidence_label} confidence</span>}
      bodyClassName=""
    >
      <div className="tabstrip" style={{ padding: '0 18px', background: 'var(--surface)' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            className="tab"
            data-active={activeSubTab === t.id}
            onClick={() => setActiveSubTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="modal-body">
        {activeSubTab === 'overview' && (
          <div className="stack">
            <Panel
              title="Transparent score decomposition"
              note={`Composite ${entityScore.overall_risk_score} of 100, built from four weighted components.`}
            >
              <div className="grid-quarters">
                {WEIGHTS.map((w) => {
                  const raw = Number(entityScore[w.key] ?? 0);
                  return (
                    <div className="inset" key={w.key} style={{ padding: 12 }}>
                      <div className="row-between" style={{ marginBottom: 6 }}>
                        <span className="text-xs dim">{w.label}</span>
                        <span className="text-xs dim mono">×{formatScore(w.weight, 2)}</span>
                      </div>
                      <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>
                        {raw}
                      </div>
                      <div className="text-xs dim" style={{ marginTop: 4 }}>
                        contributes {formatScore(w.weight * raw, 1)} points
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <Meter
                          value={raw}
                          tone={raw >= 75 ? 'danger' : raw >= 50 ? 'warn' : 'accent'}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Operational metrics">
              <dl className="kv-grid">
                {[
                  ['Alerts submitted', `${entityScore.total_alerts_count}`],
                  ['Critical / high alerts', `${entityScore.critical_alerts_count}`],
                  ['Active assets', `${entityScore.active_assets_count}`],
                  ['Critical assets', `${entityScore.critical_assets_count}`],
                  ['Silent critical assets', `${entityScore.silent_critical_assets_count}`],
                  ['Unresolved critical alerts', `${entityScore.unresolved_critical_alerts}`],
                  ['Escalated cases', `${entityScore.escalated_cases_count}`],
                  ['Median closure duration', closureLabel],
                ].map(([label, value]) => (
                  <div className="kv" key={label}>
                    <dt>{label}</dt>
                    <dd className="mono">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        )}

        {activeSubTab === 'findings' && (
          <div className="stack">
            {entityFindings.length === 0 ? (
              <Panel>
                <EmptyState>No findings were raised against this entity.</EmptyState>
              </Panel>
            ) : (
              entityFindings.map((f) => (
                <Panel key={f.finding_id} bodyClassName="panel-body">
                  <div className="row-between" style={{ marginBottom: 8 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="mono text-xs dim">{f.finding_id}</span>
                      <span className="title-sm">{f.finding_type}</span>
                    </div>
                    <Badge tone={severityTone(f.severity)}>{f.severity}</Badge>
                  </div>

                  <div className="text-sm muted">{f.rationale}</div>

                  <div className="callout callout-warn" style={{ marginTop: 10 }}>
                    <div>
                      <strong>Uncertainty note.</strong> {f.uncertainty_note}
                    </div>
                  </div>

                  <div className="row-between" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                    <span className="text-xs dim">
                      Rule <span className="mono">{f.rule_id}</span> v{f.rule_version} · score {f.score}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--fg)' }}>
                      Recommended: {f.recommended_action}
                    </span>
                  </div>
                </Panel>
              ))
            )}
          </div>
        )}

        {activeSubTab === 'peer' && (
          <Panel
            title={`Peer comparison — ${entityScore.peer_group}`}
            note="Metrics where this entity departs materially from its cohort."
            bodyClassName=""
          >
            {peerMetrics.length === 0 ? (
              <EmptyState>The cohort is too small to produce comparable benchmarks.</EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th style={{ width: 110, textAlign: 'right' }}>Entity</th>
                      <th style={{ width: 110, textAlign: 'right' }}>Peer median</th>
                      <th style={{ width: 110, textAlign: 'right' }}>Percentile</th>
                      <th style={{ width: 110 }}>Sample</th>
                      <th style={{ width: 200 }}>Interpretation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {peerMetrics.map((m) => (
                      <tr key={m.metric_id}>
                        <td className="cell-strong" style={{ fontWeight: 500 }}>{m.metric_name}</td>
                        <td className="cell-num cell-strong">
                          {m.entity_value} <span className="cell-sub">{m.unit}</span>
                        </td>
                        <td className="cell-num">{m.peer_median}</td>
                        <td className="cell-num">
                          {m.peer_percentile}
                          <div style={{ marginTop: 4 }}>
                            <Meter value={m.peer_percentile} tone={m.direction_of_concern === 'Lower' ? 'warn' : 'accent'} />
                          </div>
                        </td>
                        <td>
                          <Badge tone={m.data_sufficiency_status === 'Sufficient' ? 'low' : 'high'}>
                            {m.data_sufficiency_status}
                          </Badge>
                          <div className="cell-sub">{m.peer_sample_size} entities</div>
                        </td>
                        <td className="muted">{m.interpretation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {activeSubTab === 'assets' && (
          <Panel
            title="Asset inventory and visibility"
            note={`${entityAssets.filter((a) => a.criticality === 'Critical').length} of ${entityAssets.length} assets are rated critical.`}
            bodyClassName=""
          >
            {entityAssets.length === 0 ? (
              <EmptyState>No assets are recorded for this entity.</EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 150 }}>Asset</th>
                      <th style={{ width: 260 }}>Type</th>
                      <th style={{ width: 110 }}>Criticality</th>
                      <th style={{ width: 120 }}>Environment</th>
                      <th>Expected controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entityAssets.map((a) => (
                      <tr key={a.asset_id}>
                        <td className="mono cell-strong">{a.asset_id}</td>
                        <td>{a.asset_type}</td>
                        <td>
                          <Badge tone={a.criticality === 'Critical' ? 'critical' : a.criticality === 'High' ? 'high' : 'neutral'}>
                            {a.criticality}
                          </Badge>
                        </td>
                        <td className="muted">{a.environment}</td>
                        <td>
                          <div className="row" style={{ gap: 4 }}>
                            {a.expected_controls.map((c) => (
                              <span className="chip" key={c}>{c}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {activeSubTab === 'queue' && (
          <Panel title="Review items for this entity" bodyClassName="">
            {entityQueue.length === 0 ? (
              <EmptyState>No queue items reference this entity.</EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 130 }}>Queue item</th>
                      <th style={{ width: 120 }}>Alert / case</th>
                      <th style={{ width: 90, textAlign: 'right' }}>Priority</th>
                      <th>Evidence</th>
                      <th style={{ width: 130 }}>Status</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {entityQueue.map((item) => (
                      <tr
                        key={item.queue_item_id}
                        className="is-clickable"
                        onClick={() => onSelectReviewItem?.(item)}
                      >
                        <td className="mono cell-strong">{item.queue_item_id}</td>
                        <td className="mono">{item.alert_id || item.case_id || '—'}</td>
                        <td className="cell-num">
                          <Badge tone={bandTone(item.priority_band)} mono>{item.priority_score}</Badge>
                        </td>
                        <td>
                          <div className="clamp-2">{item.evidence_summary}</div>
                        </td>
                        <td>
                          <Badge tone={statusTone(item.review_status)}>{item.review_status}</Badge>
                        </td>
                        <td>
                          <ChevronRight size={14} color="var(--fg-3)" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}
      </div>
    </Modal>
  );
};
