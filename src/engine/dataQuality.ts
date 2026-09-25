/**
 * Data Quality Engine for SAT-SA (Sections 8 & 9.8)
 * Performs strict validation and flags structural, relational, and temporal defects
 * Computes a transparent data-quality score separate from cyber-operational risk.
 */

import {
  EntityRecord,
  AssetRecord,
  AlertRecord,
  CaseRecord,
  EscalationRecord,
  DataQualityReport,
  DataQualityIssue
} from '../types';

export function runDataQualityAssessment(
  entities: EntityRecord[],
  assets: AssetRecord[],
  alerts: AlertRecord[],
  cases: CaseRecord[],
  escalations: EscalationRecord[]
): DataQualityReport {
  const issues: DataQualityIssue[] = [];
  
  const knownAssetIds = new Set(assets.map(a => a.asset_id));
  const knownAlertIds = new Set<string>();
  const duplicateAlertIds = new Set<string>();
  const knownCaseIds = new Set<string>();
  const duplicateCaseIds = new Set<string>();

  // Track ID counts for duplicates
  alerts.forEach(a => {
    if (knownAlertIds.has(a.alert_id)) {
      duplicateAlertIds.add(a.alert_id);
    } else {
      knownAlertIds.add(a.alert_id);
    }
  });

  cases.forEach(c => {
    if (knownCaseIds.has(c.case_id)) {
      duplicateCaseIds.add(c.case_id);
    } else {
      knownCaseIds.add(c.case_id);
    }
  });

  // 1. Duplicate IDs
  if (duplicateAlertIds.size > 0) {
    issues.push({
      id: 'DQ-DUP-ALERT',
      rule_name: 'Duplicate Alert Identifiers',
      severity: 'High',
      description: `Discovered ${duplicateAlertIds.size} alert IDs submitted more than once in the periodic submission batch.`,
      table_affected: 'alerts',
      affected_row_count: duplicateAlertIds.size,
      sample_identifiers: Array.from(duplicateAlertIds).slice(0, 5)
    });
  }

  // 2. Temporal Inversions: Close time earlier than creation time
  const invertedAlerts = alerts.filter(a => {
    if (!a.created_at || !a.closed_at) return false;
    const createTime = new Date(a.created_at).getTime();
    const closeTime = new Date(a.closed_at).getTime();
    return closeTime < createTime;
  });

  if (invertedAlerts.length > 0) {
    issues.push({
      id: 'DQ-TIME-INVERT',
      rule_name: 'Temporal Inversion (Close Before Creation)',
      severity: 'High',
      description: `Alert records contain closure timestamps that predate initial detection timestamp. Indicates corrupted syslog or clock drift.`,
      table_affected: 'alerts',
      affected_row_count: invertedAlerts.length,
      sample_identifiers: invertedAlerts.map(a => a.alert_id).slice(0, 5)
    });
  }

  // 3. Acknowledgement after Closure
  const lateAckAlerts = alerts.filter(a => {
    if (!a.acknowledged_at || !a.closed_at) return false;
    const ackTime = new Date(a.acknowledged_at).getTime();
    const closeTime = new Date(a.closed_at).getTime();
    return ackTime > closeTime;
  });

  if (lateAckAlerts.length > 0) {
    issues.push({
      id: 'DQ-TIME-ACK-POST-CLOSE',
      rule_name: 'Acknowledgement Recorded Post-Closure',
      severity: 'Medium',
      description: `Alert acknowledged after case disposition was marked closed.`,
      table_affected: 'alerts',
      affected_row_count: lateAckAlerts.length,
      sample_identifiers: lateAckAlerts.map(a => a.alert_id).slice(0, 5)
    });
  }

  // 4. Orphan Cases (referencing non-existent alerts)
  const orphanCases = cases.filter(c => !knownAlertIds.has(c.alert_id));
  if (orphanCases.length > 0) {
    issues.push({
      id: 'DQ-REL-ORPHAN-CASE',
      rule_name: 'Orphan Case Records (Broken Alert FK)',
      severity: 'High',
      description: `Case investigations reference alert IDs that are missing from the alert submission table.`,
      table_affected: 'cases',
      affected_row_count: orphanCases.length,
      sample_identifiers: orphanCases.map(c => c.case_id).slice(0, 5)
    });
  }

  // 5. Orphan Escalations (referencing non-existent cases)
  const orphanEscalations = escalations.filter(e => !knownCaseIds.has(e.case_id));
  if (orphanEscalations.length > 0) {
    issues.push({
      id: 'DQ-REL-ORPHAN-ESC',
      rule_name: 'Orphan Escalation Records (Broken Case FK)',
      severity: 'High',
      description: `Escalations logged without matching case investigation records.`,
      table_affected: 'escalations',
      affected_row_count: orphanEscalations.length,
      sample_identifiers: orphanEscalations.map(e => e.escalation_id).slice(0, 5)
    });
  }

  // 6. Unknown Asset References
  const unknownAssetAlerts = alerts.filter(a => !knownAssetIds.has(a.asset_id));
  if (unknownAssetAlerts.length > 0) {
    issues.push({
      id: 'DQ-REL-UNKNOWN-ASSET',
      rule_name: 'Unmapped Asset Identifiers',
      severity: 'High',
      description: `Alerts trigger on assets not present in the submitted entity asset inventory manifest.`,
      table_affected: 'alerts',
      affected_row_count: unknownAssetAlerts.length,
      sample_identifiers: unknownAssetAlerts.map(a => `${a.alert_id}->${a.asset_id}`).slice(0, 5)
    });
  }

  // 7. Null or Unusually Short Investigation Notes (< 15 characters)
  const shortNoteCases = cases.filter(c => !c.investigation_notes || c.investigation_notes.trim().length < 15);
  if (shortNoteCases.length > 0) {
    issues.push({
      id: 'DQ-VAL-TRUNCATED-NOTES',
      rule_name: 'Truncated or Null Investigation Notes',
      severity: 'Medium',
      description: `Case records closed with blank or sub-15-character notes (e.g. 'ok', 'resolved'), failing audit sufficiency.`,
      table_affected: 'cases',
      affected_row_count: shortNoteCases.length,
      sample_identifiers: shortNoteCases.map(c => c.case_id).slice(0, 5)
    });
  }

  // 8. Missing Timestamps in critical fields
  const missingTimestampAlerts = alerts.filter(a => !a.created_at || (a.disposition !== 'Pending' && !a.closed_at));
  if (missingTimestampAlerts.length > 0) {
    issues.push({
      id: 'DQ-VAL-MISSING-TIMESTAMP',
      rule_name: 'Missing Event Timestamps',
      severity: 'Medium',
      description: `Alerts marked closed without an explicit closed_at timestamp.`,
      table_affected: 'alerts',
      affected_row_count: missingTimestampAlerts.length,
      sample_identifiers: missingTimestampAlerts.map(a => a.alert_id).slice(0, 5)
    });
  }

  const totalRecords = alerts.length + cases.length + escalations.length + assets.length;
  
  // Calculate weighted penalty
  let penalty = 0;
  issues.forEach(issue => {
    const weight = issue.severity === 'High' ? 12 : issue.severity === 'Medium' ? 6 : 2;
    penalty += Math.min(25, issue.affected_row_count * weight);
  });

  const overallScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  return {
    overall_score: overallScore,
    total_records_analyzed: totalRecords,
    rejected_records_count: duplicateAlertIds.size + invertedAlerts.length + orphanCases.length,
    duplicate_ids_count: duplicateAlertIds.size,
    missing_timestamps_count: missingTimestampAlerts.length,
    temporal_inversions_count: invertedAlerts.length,
    orphan_cases_count: orphanCases.length,
    orphan_escalations_count: orphanEscalations.length,
    unknown_assets_count: unknownAssetAlerts.length,
    short_notes_count: shortNoteCases.length,
    issues
  };
}
