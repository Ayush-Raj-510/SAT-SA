import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { EntityRiskScore, FindingRecord, ReviewQueueItem, DataQualityReport } from '../types';
import { PageHeader, Panel, Stat, Badge, Meter, bandTone, EmptyState } from './ui';
import { CHART, RISK_COLOR } from './chartTheme';

interface OverviewTabProps {
  entityScores: EntityRiskScore[];
  findings: FindingRecord[];
  reviewQueue: ReviewQueueItem[];
  dataQuality: DataQualityReport;
  onSelectEntity: (entityId: string) => void;
  onNavigateTab: (tab: string) => void;
  datasetHash: string;
  runId: string;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  entityScores,
  findings,
  reviewQueue,
  dataQuality,
  onSelectEntity,
  onNavigateTab,
  datasetHash,
  runId,
}) => {
  const highRiskEntities = entityScores.filter((e) => e.overall_risk_score >= 50);
  const executionGapFindings = findings.filter((f) => f.finding_class === 'execution_gap');
  const negativeSpaceFindings = findings.filter((f) => f.finding_class === 'negative_space');
  const silentCriticalAssets = entityScores.reduce((acc, e) => acc + e.silent_critical_assets_count, 0);
  const escalationBypass = findings.filter((f) => f.rule_id === 'EXEC-ESC-BYPASS-002').length;
  const openQueue = reviewQueue.filter((q) => q.review_status === 'Pending').length;

  const reportingPeriod = entityScores[0]?.reporting_period ?? '2026-Q3';

  const chartData = entityScores.map((e) => ({
    name: e.entity_id,
    Composite: e.overall_risk_score ?? 0,
    'Execution gap': e.execution_gap_score ?? 0,
    'Negative space': e.negative_space_score ?? 0,
  }));

  return (
    <div className="stack">
      <PageHeader
        eyebrow={`Reporting period ${reportingPeriod}`}
        title="Assessment of critical sector entities"
        description={
          <>
            {entityScores.length} entities assessed.{' '}
            {highRiskEntities.length} scoring 50 or above on the composite index.{' '}
            {reviewQueue.length} items awaiting determination.
          </>
        }
        actions={
          <>
            <button className="btn btn-outline" onClick={() => onNavigateTab('benchmark')}>
              Ground-truth benchmark
            </button>
            <button className="btn btn-primary" onClick={() => onNavigateTab('queue')}>
              Review queue ({reviewQueue.length}) <ArrowRight size={13} />
            </button>
          </>
        }
      />

      <div className="stat-grid stagger">
        <Stat
          label="Priority attention"
          value={highRiskEntities.length}
          unit={`/ ${entityScores.length}`}
          tone="critical"
          hint="Entities scoring 50 or above on the composite index."
        />
        <Stat
          label="Escalation bypasses"
          value={escalationBypass}
          unit="findings"
          tone="high"
          hint="High or critical cases closed without a mandated escalation record."
        />
        <Stat
          label="Silent critical assets"
          value={silentCriticalAssets}
          tone="accent"
          hint="Critical OT/IT assets with zero telemetry in the reporting period."
        />
        <Stat
          label="Data quality index"
          value={dataQuality.overall_score}
          unit="/ 100"
          hint={`${dataQuality.issues.length} structural rule${dataQuality.issues.length === 1 ? '' : 's'} flagged.`}
        />
        <Stat
          label="Open queue items"
          value={openQueue}
          unit={`/ ${reviewQueue.length}`}
          hint="Awaiting an examiner determination."
        />
      </div>

      <div className="grid-main">
        <Panel
          title="Entities requiring supervisory attention"
          note="Composite = 0.40 × execution gap + 0.35 × negative space + 0.15 × trend + 0.10 × peer deviation"
          actions={
            <button className="btn btn-sm btn-outline" onClick={() => onNavigateTab('leaderboard')}>
              Full ranking
            </button>
          }
          bodyClassName="panel-body"
        >
          <div className="inset" style={{ padding: 14, marginBottom: 14 }}>
            <div className="row-between" style={{ marginBottom: 10 }}>
              <span className="text-xs dim">Comparative risk vector</span>
              <span className="text-xs dim mono">scale 0–100</span>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="name" tick={CHART.tick} stroke={CHART.axis} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={CHART.tickSm} stroke={CHART.axis} tickLine={false} />
                  <Tooltip
                    contentStyle={CHART.tooltip}
                    itemStyle={CHART.tooltipItem}
                    labelStyle={CHART.tooltipLabel}
                    cursor={CHART.cursor}
                  />
                  <Legend wrapperStyle={CHART.legend} />
                  <Bar dataKey="Composite" fill="#c23d3d" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Execution gap" fill="#b97324" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Negative space" fill="#2f66d8" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th>Entity</th>
                <th style={{ width: 150 }}>Composite</th>
                <th style={{ width: 150 }}>Execution gap</th>
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {entityScores.map((score) => (
                <tr key={score.entity_id} className="is-clickable" onClick={() => onSelectEntity(score.entity_id)}>
                  <td className="cell-strong">{score.rank}</td>
                  <td>
                    <button
                      type="button"
                      className="row-link"
                      title={`Open ${score.entity_name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEntity(score.entity_id);
                      }}
                    >
                      {score.entity_name}
                    </button>
                    <div className="cell-sub mono">
                      {score.entity_id} · {score.sector}
                    </div>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="cell-strong" style={{ width: 26, color: RISK_COLOR(score.overall_risk_score) }}>
                        {score.overall_risk_score}
                      </span>
                      <div style={{ flex: 1, minWidth: 40 }}>
                        <Meter
                          value={score.overall_risk_score}
                          tone={score.overall_risk_score >= 75 ? 'danger' : score.overall_risk_score >= 50 ? 'warn' : 'accent'}
                        />
                      </div>
                      <Badge tone={bandTone(score.prioritization_band)}>{score.prioritization_band}</Badge>
                    </div>
                  </td>
                  <td className="cell-num">{score.execution_gap_score}</td>
                  <td>
                    <ChevronRight size={14} color="var(--fg-3)" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="panel-foot" style={{ borderTop: '1px solid var(--line)', marginTop: 0, paddingLeft: 0 }}>
            Run <span className="mono">{runId}</span> · dataset SHA-256{' '}
            <span className="mono">{datasetHash.slice(0, 16)}…</span>
          </div>
        </Panel>

        <div className="stack">
          <Panel
            title="Failure modes"
            note="The two classes of deficiency this engine is built to surface."
          >
            <div className="stack-12">
              <div className="inset" style={{ padding: 12 }}>
                <div className="row-between" style={{ marginBottom: 5 }}>
                  <span className="title-sm" style={{ color: 'var(--danger)' }}>
                    Execution gaps · {executionGapFindings.length}
                  </span>
                  <button className="btn-link" onClick={() => onNavigateTab('findings')}>
                    View
                  </button>
                </div>
                <p className="text-xs muted" style={{ margin: 0 }}>
                  Controls are documented, yet the records show sub-minute closures, boilerplate
                  investigation notes and un-escalated high-impact cases.
                </p>
              </div>

              <div className="inset" style={{ padding: 12 }}>
                <div className="row-between" style={{ marginBottom: 5 }}>
                  <span className="title-sm" style={{ color: 'var(--accent-hi)' }}>
                    Negative space · {negativeSpaceFindings.length}
                  </span>
                  <button className="btn-link" onClick={() => onNavigateTab('findings')}>
                    View
                  </button>
                </div>
                <p className="text-xs muted" style={{ margin: 0 }}>
                  Expected evidence is missing: silent SCADA and domain-controller assets, absent
                  telemetry categories, or large coverage drops between quarters.
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="Detector suite" note="Rule set v1.2.0-STABLE, evaluated deterministically.">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 1 }}>
              {[
                ['Fast closure', 'Closures under 120s against peer IQR', 'triggered'],
                ['Escalation bypass', 'High-impact cases with no escalation record', 'triggered'],
                ['Repetitive notes', 'Near-duplicate investigation text', 'triggered'],
                ['Silent critical asset', 'Critical assets with zero alerts', 'triggered'],
                ['Coverage drop', 'Peer-relative coverage fall beyond 50%', 'triggered'],
                ['Peer low activity', 'Normalised telemetry density vs cohort', 'active'],
                ['Category absence', 'Standard telemetry categories never observed', 'triggered'],
                ['Disposition bias', 'Benign/false-positive rate above 80%', 'triggered'],
                ['Workload concentration', 'One investigator over 70% of cases', 'triggered'],
                ['Isolation forest', 'Multivariate operational anomaly discovery', 'active'],
                ['Data quality', 'Structural and relational integrity assessor', 'active'],
              ].map(([name, desc, state]) => (
                <li
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '7px 0',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="text-sm" style={{ color: 'var(--fg)' }}>{name}</div>
                    <div className="text-xs dim">{desc}</div>
                  </div>
                  <Badge tone={state === 'triggered' ? 'high' : 'neutral'}>{state}</Badge>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Findings by class">
            {findings.length === 0 ? (
              <EmptyState>No findings were raised for the active dataset.</EmptyState>
            ) : (
              <div className="stack-8">
                {(
                  [
                    ['execution_gap', 'Execution gap', 'critical'],
                    ['negative_space', 'Negative space', 'accent'],
                    ['data_quality', 'Data quality', 'high'],
                    ['anomaly_discovery', 'Anomaly discovery', 'medium'],
                  ] as const
                ).map(([cls, label, tone]) => {
                  const count = findings.filter((f) => f.finding_class === cls).length;
                  const pct = findings.length ? (count / findings.length) * 100 : 0;
                  return (
                    <div key={cls}>
                      <div className="row-between" style={{ marginBottom: 4 }}>
                        <span className="text-sm muted">{label}</span>
                        <span className="text-sm mono fg">{count}</span>
                      </div>
                      <Meter value={pct} tone={tone === 'high' ? 'warn' : tone === 'critical' ? 'danger' : 'accent'} />
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
};
