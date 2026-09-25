import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronDown, AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { EntityTrend } from '../types';
import { PageHeader, Panel, Badge, Stat, EmptyState, Meter } from './ui';
import { CHART, SERIES_COLORS, RISK_COLOR } from './chartTheme';

interface TrendAnalysisTabProps {
  entityTrends: EntityTrend[];
}

const TrendBadge: React.FC<{ direction: EntityTrend['trend_direction']; delta: number }> = ({
  direction,
  delta,
}) => {
  if (direction === 'Deteriorating') {
    return (
      <Badge tone="critical">
        <TrendingUp size={11} /> +{Math.abs(delta).toFixed(0)} pts
      </Badge>
    );
  }
  if (direction === 'Improving') {
    return (
      <Badge tone="low">
        <TrendingDown size={11} /> −{Math.abs(delta).toFixed(0)} pts
      </Badge>
    );
  }
  if (direction === 'Stable') {
    return (
      <Badge tone="neutral">
        <Minus size={11} /> stable
      </Badge>
    );
  }
  return <Badge tone="high">insufficient data</Badge>;
};

export const TrendAnalysisTab: React.FC<TrendAnalysisTabProps> = ({ entityTrends }) => {
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);

  const allPeriods = useMemo(
    () => Array.from(new Set(entityTrends.flatMap((t) => t.snapshots.map((s) => s.period)))).sort(),
    [entityTrends],
  );

  const combinedData = useMemo(
    () =>
      allPeriods.map((period) => {
        const row: Record<string, any> = { period };
        entityTrends.forEach((t) => {
          const snap = t.snapshots.find((s) => s.period === period);
          if (snap) row[t.entity_id] = snap.overall_risk_score;
        });
        return row;
      }),
    [allPeriods, entityTrends],
  );

  const deteriorating = entityTrends.filter(
    (t) => t.trend_direction === 'Deteriorating' || t.consecutive_deterioration_quarters >= 2,
  );
  const persistent = deteriorating.filter((t) => t.consecutive_deterioration_quarters >= 2);

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Multi-period trend analysis"
        title="Entity risk trajectory"
        description={`Longitudinal comparison across ${allPeriods.length} reporting period${allPeriods.length === 1 ? '' : 's'}. Sustained deterioration indicates systemic degradation rather than an isolated anomaly.`}
      />

      <div className="stat-grid stagger">
        <Stat label="Reporting periods" value={allPeriods.length} hint={allPeriods.join(' · ')} />
        <Stat
          label="Deteriorating"
          value={deteriorating.length}
          tone="critical"
          hint="Risk score rising quarter on quarter."
        />
        <Stat
          label="Persistent decline"
          value={persistent.length}
          tone="high"
          hint="Worsening across two or more consecutive quarters."
        />
        <Stat label="Entities tracked" value={entityTrends.length} hint="Entities with at least one period of data." />
      </div>

      {persistent.length > 0 && (
        <div className="callout callout-danger">
          <AlertTriangle size={16} />
          <div>
            <strong>Persistent deterioration.</strong> {persistent.map((t) => t.entity_name).join(', ')}{' '}
            {persistent.length === 1 ? 'has' : 'have'} shown a rising risk score for two or more consecutive
            quarters, which warrants direct supervisory intervention rather than routine review.
          </div>
        </div>
      )}

      <Panel title="Composite risk score over time">
        {allPeriods.length < 2 ? (
          <EmptyState>At least two reporting periods are required to plot a trajectory.</EmptyState>
        ) : (
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedData} margin={{ top: 8, right: 16, left: -18, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 2" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="period" tick={CHART.tick} stroke={CHART.axis} tickLine={false} />
                <YAxis domain={[0, 100]} tick={CHART.tick} stroke={CHART.axis} tickLine={false} />
                <Tooltip
                  contentStyle={CHART.tooltip}
                  itemStyle={CHART.tooltipItem}
                  labelStyle={CHART.tooltipLabel}
                  formatter={(val: any, name: string) => [
                    `${val} / 100`,
                    entityTrends.find((t) => t.entity_id === name)?.entity_name || name,
                  ]}
                />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: 'var(--fg-2)', fontSize: 11 }}>
                      {entityTrends.find((t) => t.entity_id === value)?.entity_name || value}
                    </span>
                  )}
                  wrapperStyle={CHART.legend}
                />
                {entityTrends.map((t, i) => (
                  <Line
                    key={t.entity_id}
                    type="monotone"
                    dataKey={t.entity_id}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={1.8}
                    dot={{ r: 2.5, strokeWidth: 0, fill: SERIES_COLORS[i % SERIES_COLORS.length] }}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title="Entity trend summary" bodyClassName="">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Entity</th>
                <th style={{ width: 130 }}>Direction</th>
                <th style={{ width: 170 }}>Latest score</th>
                <th style={{ width: 190 }}>Period change</th>
                <th style={{ width: 120, textAlign: 'right' }}>Alerts</th>
                <th style={{ width: 130, textAlign: 'right' }}>Findings</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {entityTrends.map((trend, i) => {
                const isOpen = expandedEntity === trend.entity_id;
                const latest = trend.snapshots[trend.snapshots.length - 1];
                const previous = trend.snapshots.length >= 2 ? trend.snapshots[trend.snapshots.length - 2] : null;

                return (
                  <React.Fragment key={trend.entity_id}>
                    <tr
                      className="is-clickable"
                      onClick={() => setExpandedEntity(isOpen ? null : trend.entity_id)}
                    >
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <span
                            style={{
                              width: 3,
                              height: 26,
                              borderRadius: 2,
                              background: SERIES_COLORS[i % SERIES_COLORS.length],
                              flexShrink: 0,
                            }}
                          />
                          <div>
                            <div className="cell-strong">{trend.entity_name}</div>
                            <div className="cell-sub mono">{trend.entity_id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <TrendBadge direction={trend.trend_direction} delta={trend.trend_delta} />
                      </td>
                      <td>
                        {latest ? (
                          <div className="row" style={{ gap: 8 }}>
                            <span className="cell-strong mono" style={{ color: RISK_COLOR(latest.overall_risk_score) }}>
                              {latest.overall_risk_score}
                            </span>
                            <div style={{ width: 60 }}>
                              <Meter
                                value={latest.overall_risk_score}
                                tone={latest.overall_risk_score >= 75 ? 'danger' : latest.overall_risk_score >= 50 ? 'warn' : 'accent'}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="dim">no data</span>
                        )}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 3, alignItems: 'flex-end', height: 22 }}>
                          {trend.snapshots.map((snap, si) => (
                            <span
                              key={si}
                              title={`${snap.period}: ${snap.overall_risk_score}`}
                              style={{
                                width: 7,
                                borderRadius: 2,
                                height: Math.max(3, Math.round((snap.overall_risk_score / 100) * 20)),
                                background: RISK_COLOR(snap.overall_risk_score),
                              }}
                            />
                          ))}
                          {previous && latest && (
                            <span className="text-xs dim" style={{ marginLeft: 6 }}>
                              {previous.period} → {latest.period}: {trend.trend_delta > 0 ? '+' : ''}
                              {trend.trend_delta.toFixed(0)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="cell-num">{latest?.total_alerts ?? '—'}</td>
                      <td className="cell-num">{latest?.findings_count ?? '—'}</td>
                      <td>
                        <ChevronDown
                          size={15}
                          color="var(--fg-3)"
                          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                        />
                      </td>
                    </tr>

                    {isOpen && (
                      <tr>
                        <td colSpan={7} style={{ background: 'var(--surface-inset)', padding: 16 }}>
                          <div className="grid-quarters">
                            {trend.snapshots.map((snap) => (
                              <div className="inset" key={snap.period} style={{ padding: 12 }}>
                                <div className="text-xs dim mono">{snap.period}</div>
                                <div
                                  className="mono"
                                  style={{
                                    fontSize: 20,
                                    fontWeight: 600,
                                    color: RISK_COLOR(snap.overall_risk_score),
                                    marginTop: 4,
                                  }}
                                >
                                  {snap.overall_risk_score}
                                </div>
                                <div className="text-xs muted" style={{ marginTop: 6 }}>
                                  Execution {snap.execution_gap_score} · negative space {snap.negative_space_score}
                                </div>
                                <div className="text-xs dim">
                                  {snap.total_alerts} alerts · {snap.critical_alerts} critical ·{' '}
                                  {snap.findings_count} findings
                                </div>
                              </div>
                            ))}
                          </div>

                          {trend.consecutive_deterioration_quarters >= 2 && (
                            <div className="callout callout-warn" style={{ marginTop: 12 }}>
                              <AlertTriangle size={15} />
                              <div>
                                {trend.consecutive_deterioration_quarters} consecutive deteriorating quarters
                                recorded for this entity.
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};
