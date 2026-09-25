/**
 * CSV Export Utilities for SAT-SA
 * Generates downloadable CSV files for findings, review queue, and entity scores.
 * Each export includes a metadata header with Run ID and Dataset Hash.
 */

import { FindingRecord, ReviewQueueItem, EntityRiskScore } from "../types";

function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildMetaHeader(runId: string, datasetHash: string, title: string): string {
  return [
    `# SAT-SA Export: ${title}`,
    `# Run ID: ${runId}`,
    `# Dataset Hash (SHA-256): ${datasetHash}`,
    `# Exported At: ${new Date().toISOString()}`,
    `# NCIIPC Supervisory Analytics Tool -- Air-Gapped Enclave`,
    ``
  ].join("\n");
}

export function exportFindingsCSV(findings: FindingRecord[], runId: string, datasetHash: string) {
  const header = buildMetaHeader(runId, datasetHash, "Detector Findings");
  const cols = [
    "Finding ID","Entity ID","Period","Rule ID","Finding Type","Class",
    "Severity","Score","Status","Rationale","Recommended Action","Created At"
  ];
  const rows = findings.map(f => [
    f.finding_id,
    f.entity_id,
    f.period,
    f.rule_id,
    `"${f.finding_type.replace(/"/g, "'")}"`,
    f.finding_class,
    f.severity,
    f.score,
    f.status,
    `"${f.rationale.replace(/"/g, "'")}"`,
    `"${f.recommended_action.replace(/"/g, "'")}"`,
    f.created_at
  ].join(","));

  downloadCSV(`sat_sa_findings_${runId}.csv`, header + cols.join(",") + "\n" + rows.join("\n"));
}

export function exportReviewQueueCSV(queue: ReviewQueueItem[], runId: string, datasetHash: string) {
  const header = buildMetaHeader(runId, datasetHash, "Review Queue");
  const cols = [
    "Queue Item ID","Entity ID","Entity Name","Severity","Priority Score",
    "Priority Band","Review Status","Examiner Comment","Created At"
  ];
  const rows = queue.map(q => [
    q.queue_item_id,
    q.entity_id,
    `"${q.entity_name.replace(/"/g, "'")}"`,
    q.severity,
    q.priority_score,
    q.priority_band,
    q.review_status,
    `"${(q.examiner_comment || "").replace(/"/g, "'")}"`,
    q.created_at
  ].join(","));

  downloadCSV(`sat_sa_review_queue_${runId}.csv`, header + cols.join(",") + "\n" + rows.join("\n"));
}

export function exportEntityScoresCSV(scores: EntityRiskScore[], runId: string, datasetHash: string) {
  const header = buildMetaHeader(runId, datasetHash, "Entity Risk Scores");
  const cols = [
    "Rank","Entity ID","Entity Name","Sector","Peer Group","Reporting Period",
    "Overall Risk Score","Prioritization Band",
    "Execution Gap Score","Negative Space Score","Trend Score","Peer Dev Score",
    "Data Quality Score","Confidence","Total Alerts","Critical Alerts",
    "Silent Critical Assets","Escalated Cases","Median Closure Time (s)"
  ];
  const rows = scores.map(s => [
    s.rank, s.entity_id,
    `"${s.entity_name.replace(/"/g, "'")}"`,
    s.sector,
    `"${s.peer_group.replace(/"/g, "'")}"`,
    s.reporting_period,
    s.overall_risk_score, s.prioritization_band,
    s.execution_gap_score, s.negative_space_score,
    s.trend_deterioration_score, s.unexplained_peer_deviation_score,
    s.data_quality_score, s.confidence_label,
    s.total_alerts_count, s.critical_alerts_count,
    s.silent_critical_assets_count, s.escalated_cases_count,
    s.median_closure_time_seconds
  ].join(","));

  downloadCSV(`sat_sa_entity_scores_${runId}.csv`, header + cols.join(",") + "\n" + rows.join("\n"));
}
