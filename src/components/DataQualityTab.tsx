import React from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { DataQualityReport } from '../types';
import { PageHeader, Panel, Badge, Stat, EmptyState, Meter } from './ui';

interface DataQualityTabProps {
  report: DataQualityReport;
}

export const DataQualityTab: React.FC<DataQualityTabProps> = ({ report }) => {
  const counters: { label: string; value: number; note: string }[] = [
    { label: 'Rejected records', value: report.rejected_records_count, note: 'Failed schema validation and were excluded.' },
    { label: 'Duplicate identifiers', value: report.duplicate_ids_count, note: 'Primary key reused within a table.' },
    { label: 'Missing timestamps', value: report.missing_timestamps_count, note: 'Required timestamps absent or unparseable.' },
    { label: 'Temporal inversions', value: report.temporal_inversions_count, note: 'Records closed before they were created.' },
    { label: 'Orphan cases', value: report.orphan_cases_count, note: 'Cases referencing an alert that does not exist.' },
    { label: 'Orphan escalations', value: report.orphan_escalations_count, note: 'Escalations referencing a missing case.' },
    { label: 'Unknown assets', value: report.unknown_assets_count, note: 'Alerts raised against assets outside the inventory.' },
    { label: 'Truncated notes', value: report.short_notes_count, note: 'Investigation notes under 15 characters.' },
  ];

  const integrityTone =
    report.overall_score >= 90 ? 'low' : report.overall_score >= 70 ? 'high' : 'critical';
  const integrityLabel =
    report.overall_score >= 90 ? 'Sound' : report.overall_score >= 70 ? 'Acceptable with caveats' : 'Materially deficient';

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Sections 8 and 9.8 — submission integrity"
        title="Structural and relational quality assessment"
        description="Analytics computed over incomplete or corrupted submissions can be confidently wrong. SAT-SA assesses submission hygiene strictly, and flags rather than silently repairing."
      />

      <div className="grid-main">
        <Panel title="Integrity index">
          <div className="row" style={{ gap: 20, alignItems: 'center' }}>
            <div>
              <div
                className="mono"
                style={{
                  fontSize: 44,
                  fontWeight: 600,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  color:
                    report.overall_score >= 90 ? 'var(--ok)'
                    : report.overall_score >= 70 ? 'var(--warn)'
                    : 'var(--danger)',
                }}
              >
                {report.overall_score}
                <small style={{ fontSize: 16, color: 'var(--fg-3)', marginLeft: 3 }}>/100</small>
              </div>
              <Badge tone={integrityTone as 'low' | 'high' | 'critical'}>{integrityLabel}</Badge>
            </div>

            <div style={{ flex: 1, minWidth: 160 }}>
              <div className="row-between text-xs dim" style={{ marginBottom: 5 }}>
                <span>Quality score</span>
                <span>{report.total_records_analyzed} records analyzed</span>
              </div>
              <Meter
                value={report.overall_score}
                tone={report.overall_score >= 90 ? 'ok' : report.overall_score >= 70 ? 'warn' : 'danger'}
                label={`Quality score ${report.overall_score} of 100`}
              />
              <p className="text-xs dim" style={{ marginTop: 10 }}>
                Score is derived from the density of defects across alerts, cases, escalations and assets,
                weighted by the severity of each rule.
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="Defect rules flagged" note={`${report.issues.length} rule${report.issues.length === 1 ? '' : 's'} produced at least one defect.`}>
          {report.issues.length === 0 ? (
            <div className="callout callout-ok">
              <CheckCircle2 size={15} />
              <div>No integrity defects were detected in the active submission.</div>
            </div>
          ) : (
            <div className="stack-8">
              <div className="row" style={{ gap: 6 }}>
                <Badge tone="critical">
                  {report.issues.filter((i) => i.severity === 'High').length} high
                </Badge>
                <Badge tone="high">
                  {report.issues.filter((i) => i.severity === 'Medium').length} medium
                </Badge>
                <Badge tone="neutral">
                  {report.issues.filter((i) => i.severity === 'Low').length} low
                </Badge>
              </div>
              <div className="text-xs muted">
                Review the detailed rule list below; every affected row is traceable through its
                sample identifiers.
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="stat-grid stagger">
        {counters.map((c) => (
          <Stat
            key={c.label}
            label={c.label}
            value={c.value}
            tone={c.value === 0 ? 'low' : 'high'}
            hint={c.note}
          />
        ))}
      </div>

      <Panel title="Active data-quality rules" bodyClassName="">
        {report.issues.length === 0 ? (
          <EmptyState icon={<CheckCircle2 />}>No integrity rules were triggered.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Rule</th>
                  <th style={{ width: 260 }}>Defect</th>
                  <th>Description</th>
                  <th style={{ width: 150 }}>Table</th>
                  <th style={{ width: 90, textAlign: 'right' }}>Rows</th>
                  <th style={{ width: 90 }}>Severity</th>
                </tr>
              </thead>
              <tbody>
                {report.issues.map((issue) => (
                  <tr key={issue.id}>
                    <td className="mono cell-strong">{issue.id}</td>
                    <td className="cell-strong" style={{ fontWeight: 500 }}>{issue.rule_name}</td>
                    <td>
                      <div>{issue.description}</div>
                      {issue.sample_identifiers.length > 0 && (
                        <div className="row" style={{ gap: 4, marginTop: 6 }}>
                          <span className="text-xs dim">Samples</span>
                          {issue.sample_identifiers.slice(0, 8).map((id) => (
                            <span className="chip" key={id}>{id}</span>
                          ))}
                          {issue.sample_identifiers.length > 8 && (
                            <span className="text-xs dim">+{issue.sample_identifiers.length - 8}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="mono">{issue.table_affected}</td>
                    <td className="cell-num cell-strong">{issue.affected_row_count}</td>
                    <td>
                      <Badge tone={issue.severity === 'High' ? 'critical' : issue.severity === 'Medium' ? 'high' : 'neutral'}>
                        {issue.severity}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="callout callout-info">
        <Info size={15} />
        <div>
          Deficiencies are reported to the submitting entity rather than corrected in place, so that the
          supervisory record reflects exactly what was submitted.
        </div>
      </div>

      <Panel title="Why this matters" className="no-print">
        <div className="grid-thirds">
          {[
            ['Temporal inversions', 'A closure timestamp earlier than creation invalidates every derived duration metric, including the fast-closure detector.'],
            ['Orphan linkages', 'Cases and escalations that reference absent parents mean the escalation-bypass rate cannot be trusted in either direction.'],
            ['Truncated notes', 'Boilerplate or empty investigation text hides the difference between genuine triage and batch closure.'],
          ].map(([title, body]) => (
            <div className="inset" key={title} style={{ padding: 12 }}>
              <div className="row" style={{ gap: 6, marginBottom: 5 }}>
                <AlertTriangle size={13} color="var(--warn)" />
                <span className="title-sm">{title}</span>
              </div>
              <p className="text-xs muted" style={{ margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};
