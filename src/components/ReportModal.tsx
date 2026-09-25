import React, { useState } from 'react';
import { Printer, Download, FileText } from 'lucide-react';
import {
  EntityRiskScore,
  FindingRecord,
  ReviewQueueItem,
  DataQualityReport,
  AnalysisRunRecord,
  PeerBenchmarkMetric,
} from '../types';
import { Modal, Badge } from './ui';
import { formatDate, formatTimestamp } from '../engine/format';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityScores: EntityRiskScore[];
  findings: FindingRecord[];
  reviewQueue: ReviewQueueItem[];
  dataQuality: DataQualityReport;
  currentRun: AnalysisRunRecord;
  peerBenchmarks: Record<string, PeerBenchmarkMetric[]>;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  entityScores,
  findings,
  reviewQueue,
  dataQuality,
  currentRun,
}) => {
  const [selectedEntityId, setSelectedEntityId] = useState('ALL');

  if (!isOpen) return null;

  const relevantFindings =
    selectedEntityId === 'ALL' ? findings : findings.filter((f) => f.entity_id === selectedEntityId);

  // The dossier lists every prioritised item in scope. An earlier revision
  // capped the combined report at ten rows, which silently dropped the rest of
  // the queue from a document that goes out as a supervisory record.
  const relevantQueue = (
    selectedEntityId === 'ALL'
      ? reviewQueue
      : reviewQueue.filter((q) => q.entity_id === selectedEntityId)
  )
    .slice()
    .sort((a, b) => b.priority_score - a.priority_score);

  const handlePrint = () => window.print();

  const handleDownloadHTML = () => {
    const reportHTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>SAT-SA supervisory assessment report</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:40px;color:#14181f;max-width:900px;margin:0 auto;line-height:1.6;font-size:13px}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#3b4552;margin:26px 0 10px;border-bottom:1px solid #d7dce3;padding-bottom:5px}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px}
  th,td{border:1px solid #d7dce3;padding:6px 8px;text-align:left} th{background:#f1f3f6;text-transform:uppercase;letter-spacing:.05em;font-size:10px;color:#3b4552}
  .mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10.5px;color:#4a5462}
  .block{border:1px solid #d7dce3;border-left:3px solid #4179e0;border-radius:3px;padding:10px 12px;margin-bottom:8px;background:#fafbfc}
  .note{border:1px solid #ecd9ad;background:#fdf8ec;border-radius:3px;padding:8px 10px;margin-top:6px;font-size:11px;color:#6b5321}
  hr{border:0;border-top:2px solid #14181f;margin:14px 0}
</style></head><body>
<h1>SOC supervisory assessment dossier</h1>
<p>National Critical Information Infrastructure Protection Centre — SIH 26157 framework</p>
<p class="mono">Run ${currentRun.run_id} · ruleset ${currentRun.ruleset_version} · generated ${formatTimestamp(new Date())}</p>
<p class="mono">Raw dataset SHA-256: ${currentRun.dataset_hash}<br>Normalised: ${currentRun.normalized_dataset_hash}<br>Configuration: ${currentRun.configuration_hash}</p>
<hr>
<h2>1. Entity identification and risk ranking</h2>
<table><tr><th>Rank</th><th>Entity</th><th>Sector</th><th>Score</th><th>Band</th><th>Data quality</th></tr>
${entityScores.map((e) => `<tr><td>#${e.rank}</td><td>${e.entity_name} (${e.entity_id})</td><td>${e.sector}</td><td>${e.overall_risk_score}/100</td><td>${e.prioritization_band}</td><td>${e.data_quality_score}/100</td></tr>`).join('')}
</table>
<h2>2. Traceable findings (${relevantFindings.length})</h2>
${relevantFindings.map((f) => `<div class="block"><strong>[${f.finding_id}] ${f.finding_type}</strong> — ${f.severity} (${f.finding_class})<br><strong>Entity:</strong> ${f.entity_id} · <strong>Rule:</strong> ${f.rule_id} v${f.rule_version}<br><br><strong>Observed evidence:</strong> ${f.rationale}<div class="note"><strong>Uncertainty:</strong> ${f.uncertainty_note}</div><br><strong>Recommended action:</strong> ${f.recommended_action}</div>`).join('')}
<h2>3. Prioritised items for human review</h2>
<table><tr><th>Queue item</th><th>Alert / case</th><th>Entity</th><th>Priority</th><th>Evidence</th><th>Status</th></tr>
${relevantQueue.map((q) => `<tr><td>${q.queue_item_id}</td><td>${q.alert_id || q.case_id || '—'}</td><td>${q.entity_name}</td><td>${q.priority_score} (${q.priority_band})</td><td>${q.evidence_summary}</td><td>${q.review_status}</td></tr>`).join('')}
</table>
<h2>4. Submission integrity</h2>
<p>Quality index ${dataQuality.overall_score}/100 across ${dataQuality.total_records_analyzed} records. ${dataQuality.issues.length} integrity rules flagged.</p>
<table><tr><th>Rule</th><th>Defect</th><th>Table</th><th>Rows</th></tr>
${dataQuality.issues.map((i) => `<tr><td>${i.id}</td><td>${i.rule_name}</td><td>${i.table_affected}</td><td>${i.affected_row_count}</td></tr>`).join('')}
</table>
<h2>5. Evidence categorisation</h2>
<p><strong>Observed evidence</strong> is directly supported by submitted records. <strong>Analytic indication</strong> is produced by a deterministic rule or statistical comparison. <strong>Supervisory conclusion</strong> is recorded by a human examiner after review. This report contains the first two categories only; no supervisory conclusion is asserted on the examiner's behalf.</p>
<hr>
<p class="mono">Generated entirely offline inside the SAT-SA air-gapped enclave.</p>
</body></html>`;

    const blob = new Blob([reportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sat_sa_report_${selectedEntityId}_${currentRun.run_id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      title="Supervisory assessment report"
      subtitle="Printable examination dossier — sections 17 to 19 of the framework."
      onClose={onClose}
      width={980}
      printable
      actions={
        <>
          <select
            className="select"
            style={{ width: 'auto', minWidth: 230 }}
            value={selectedEntityId}
            onChange={(e) => setSelectedEntityId(e.target.value)}
            aria-label="Report scope"
          >
            <option value="ALL">All entities — combined report</option>
            {entityScores.map((e) => (
              <option key={e.entity_id} value={e.entity_id}>
                {e.entity_name} ({e.entity_id})
              </option>
            ))}
          </select>
          <button className="btn btn-outline" onClick={handleDownloadHTML}>
            <Download size={13} /> Download HTML
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={13} /> Print / save PDF
          </button>
        </>
      }
      bodyClassName="modal-body"
      footer={
        <>
          <span className="row" style={{ gap: 6 }}>
            <FileText size={12} /> Offline generation — no external service is contacted.
          </span>
          <span className="mono">{currentRun.application_version}</span>
        </>
      }
    >
      <article className="print-sheet" style={{ borderRadius: 4 }}>
        {/* ------------------------------------------------------------- header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-start' }}>
          <div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5b6572' }}>
              Confidential · air-gapped supervisory record
            </div>
            <h1 style={{ marginTop: 6 }}>SOC supervisory assessment dossier</h1>
            <div style={{ color: '#4a5462', fontSize: 12 }}>
              Evaluation of Critical Sector Entities under the NCIIPC framework (SIH 26157)
            </div>
          </div>
          <div className="mono" style={{ textAlign: 'right', fontSize: 10.5, lineHeight: 1.8 }}>
            <div>Run: {currentRun.run_id}</div>
            <div>Date: {formatDate(currentRun.created_at)}</div>
            <div>Ruleset: {currentRun.ruleset_version}</div>
            <div>Prepared by: {currentRun.created_by}</div>
          </div>
        </div>

        <hr />

        <div className="mono" style={{ lineHeight: 1.8, marginBottom: 8 }}>
          <div>Raw dataset SHA-256: {currentRun.dataset_hash}</div>
          <div>Normalised dataset SHA-256: {currentRun.normalized_dataset_hash}</div>
          <div>Configuration SHA-256: {currentRun.configuration_hash}</div>
        </div>

        {/* ------------------------------------------------------- 1. ranking */}
        <h2>1. Entity identification and risk ranking</h2>
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>Rank</th>
              <th style={{ width: 90 }}>Entity ID</th>
              <th>Entity</th>
              <th style={{ width: 200 }}>Sector</th>
              <th style={{ width: 70 }}>Score</th>
              <th style={{ width: 90 }}>Band</th>
              <th style={{ width: 80 }}>Quality</th>
            </tr>
          </thead>
          <tbody>
            {entityScores.map((e) => (
              <tr key={e.entity_id} style={selectedEntityId === e.entity_id ? { background: '#eef2f8' } : undefined}>
                <td>#{e.rank}</td>
                <td className="mono">{e.entity_id}</td>
                <td>{e.entity_name}</td>
                <td>{e.sector}</td>
                <td><strong>{e.overall_risk_score}</strong>/100</td>
                <td>{e.prioritization_band}</td>
                <td>{e.data_quality_score}/100</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ------------------------------------------------------ 2. findings */}
        <h2>2. Traceable supervisory findings ({relevantFindings.length})</h2>
        {relevantFindings.length === 0 ? (
          <p>No findings were raised for the selected scope.</p>
        ) : (
          relevantFindings.map((f) => (
            <div className="paper-block" key={f.finding_id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <strong>[{f.finding_id}] {f.finding_type}</strong>
                <span className="mono">
                  {f.severity} · {f.finding_class}
                </span>
              </div>
              <div className="mono" style={{ marginTop: 4 }}>
                Entity {f.entity_id} · rule {f.rule_id} v{f.rule_version} · score {f.score} · status {f.status}
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>Observed evidence:</strong> {f.rationale}
              </div>
              <div className="paper-note">
                <strong>Uncertainty and alternative explanations:</strong> {f.uncertainty_note}
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>Recommended supervisory action:</strong> {f.recommended_action}
              </div>
            </div>
          ))
        )}

        {/* --------------------------------------------------------- 3. queue */}
        <h2>3. Prioritised items for human review</h2>
        {relevantQueue.length === 0 ? (
          <p>No review items fall within the selected scope.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 110 }}>Queue item</th>
                <th style={{ width: 110 }}>Alert / case</th>
                <th style={{ width: 170 }}>Entity</th>
                <th style={{ width: 80 }}>Priority</th>
                <th>Evidence</th>
                <th style={{ width: 120 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {relevantQueue.map((q) => (
                <tr key={q.queue_item_id}>
                  <td className="mono">{q.queue_item_id}</td>
                  <td className="mono">{q.alert_id || q.case_id || '—'}</td>
                  <td>{q.entity_name}</td>
                  <td>{q.priority_score} ({q.priority_band})</td>
                  <td>{q.evidence_summary}</td>
                  <td>{q.review_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* -------------------------------------------------- 4. data quality */}
        <h2>4. Submission integrity</h2>
        <p>
          Quality index <strong>{dataQuality.overall_score}/100</strong> across{' '}
          <strong>{dataQuality.total_records_analyzed}</strong> records.{' '}
          {dataQuality.issues.length} integrity rule{dataQuality.issues.length === 1 ? '' : 's'} flagged,{' '}
          {dataQuality.rejected_records_count} record{dataQuality.rejected_records_count === 1 ? '' : 's'} rejected.
        </p>
        {dataQuality.issues.length > 0 && (
          <table>
            <thead>
              <tr>
                <th style={{ width: 130 }}>Rule</th>
                <th>Defect</th>
                <th style={{ width: 150 }}>Table</th>
                <th style={{ width: 70 }}>Rows</th>
              </tr>
            </thead>
            <tbody>
              {dataQuality.issues.map((i) => (
                <tr key={i.id}>
                  <td className="mono">{i.id}</td>
                  <td>{i.rule_name}</td>
                  <td className="mono">{i.table_affected}</td>
                  <td>{i.affected_row_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* -------------------------------------------- 5. evidence standard */}
        <h2>5. Evidence categorisation standard</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            ['Observed evidence', 'Directly supported by submitted records — timestamps, durations, submitted text.'],
            ['Analytic indication', 'Produced by a deterministic rule or statistical comparison, such as an interquartile distance.'],
            ['Supervisory conclusion', 'Entered by a human examiner after interview or sample validation. Not asserted by this report.'],
          ].map(([title, body]) => (
            <div key={title} className="paper-block" style={{ marginBottom: 0 }}>
              <strong>{title}</strong>
              <div style={{ marginTop: 4 }}>{body}</div>
            </div>
          ))}
        </div>

        <hr />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
          <div>
            <div style={{ fontWeight: 600 }}>Prepared within the NTRO / NCIIPC air-gapped enclave</div>
            <div className="mono" style={{ marginTop: 3 }}>
              {currentRun.application_version} · ruleset {currentRun.ruleset_version}
            </div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 220 }}>
            <div style={{ borderBottom: '1px solid #14181f', height: 26 }} />
            <div style={{ marginTop: 5 }}>Supervising examiner signature</div>
          </div>
        </div>
      </article>

      {/* On-screen only. The print stylesheet hides everything but .printable. */}
      <div
        className="no-print"
        style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <span className="text-xs dim">
          “Print / save PDF” renders only the dossier above. Pick a specific entity to narrow sections 2 and 3.
        </span>
        <Badge tone="neutral">Observed evidence</Badge>
        <Badge tone="accent">Analytic indication</Badge>
        <Badge tone="high">Requires examiner conclusion</Badge>
      </div>
    </Modal>
  );
};
