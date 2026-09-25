/**
 * SAT-SA — Supervisory Analytics Tool for SOC Assessment
 * Schema definitions according to SIH 26157 (NTRO / NCIIPC) specification
 */

export type Sector = 
  | 'Power & Energy'
  | 'Banking & Financial'
  | 'Telecommunications'
  | 'Civil Aviation & Transport'
  | 'Strategic & Defense'
  | 'Healthcare & Public Governance';

export type SizeBand = 'Tier-1 Enterprise' | 'Tier-2 Major' | 'Tier-3 Regional';

export type AssetCriticality = 'Critical' | 'High' | 'Medium' | 'Low';

export type AlertSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export type ImpactLevel = 'Critical' | 'High' | 'Medium' | 'Low';

export type FindingClass = 
  | 'execution_gap' 
  | 'negative_space' 
  | 'data_quality' 
  | 'anomaly_discovery';

export type PriorityBand = 'Critical' | 'High' | 'Medium' | 'Low';

export type ReviewStatus = 
  | 'Pending' 
  | 'Under Review' 
  | 'Verified Issue' 
  | 'False Positive' 
  | 'Exception Noted';

export type UserRole = 'Administrator' | 'Examiner' | 'Read-only Reviewer';

export interface UserPermissionSet {
  can_re_run_analytics: boolean;
  can_update_review_status: boolean;
  can_ingest_files: boolean;
  can_export_audit: boolean;
  can_generate_reports: boolean;
  can_configure_rules: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  email: string;
  badge_id: string;
  role: UserRole;
  designation: string;
  organization: string;
  clearance_level: 'Level 3 - Top Secret' | 'Level 2 - Secret' | 'Level 1 - Restricted';
  avatar_initials: string;
  assigned_sector?: string;
  session_token?: string;
  jwt_token?: string;
  auth_algorithm?: 'bcrypt + JWT' | 'SHA-256';
  last_login?: string;
  permissions: UserPermissionSet;
}

export interface EntityRecord {
  entity_id: string;
  entity_name: string;
  sector: Sector;
  size_band: SizeBand;
  peer_group: string;
  reporting_period: string; // e.g. "2026-Q1"
  source_file: string;
}

export interface AssetRecord {
  asset_id: string;
  entity_id: string;
  asset_name_hash: string;
  asset_type: string; // e.g. 'SCADA RTU', 'Domain Controller', 'Core Switch', 'Database Server', 'SWIFT Terminal'
  criticality: AssetCriticality;
  environment: 'Production' | 'Staging' | 'DMZ' | 'Internal OT';
  expected_controls: string[]; // e.g. ['EDR', 'NDR', 'Syslog', 'NetFlow']
  active_from: string;
  active_to?: string;
  source_file: string;
}

export interface AlertRecord {
  alert_id: string;
  entity_id: string;
  asset_id: string;
  alert_category: string;
  source_control: string;
  severity: AlertSeverity;
  created_at: string;
  acknowledged_at?: string;
  closed_at?: string;
  disposition: 'True Positive' | 'False Positive' | 'Benign' | 'Undetermined' | 'Pending';
  case_id?: string;
  source_row_number: number;
}

export interface CaseRecord {
  case_id: string;
  entity_id: string;
  alert_id: string;
  investigator_id_hash: string;
  investigation_started_at: string;
  investigation_completed_at?: string;
  impact: ImpactLevel;
  closure_reason: string;
  investigation_notes: string;
  source_row_number: number;
}

export interface EscalationRecord {
  escalation_id: string;
  case_id: string;
  escalation_type: 'Tier-2 Escalation' | 'CISO Notification' | 'CERT-In Reporting' | 'Emergency Containment';
  escalated_at: string;
  recipient_role: string;
  outcome: 'Acknowledged' | 'Approved Containment' | 'Remediated' | 'Pending Review';
  source_row_number: number;
}

export interface FindingRecord {
  finding_id: string;
  run_id: string;
  entity_id: string;
  period: string;
  finding_type: string;
  finding_class: FindingClass;
  severity: AlertSeverity;
  score: number; // 0-100
  rule_id: string;
  rule_version: string;
  threshold_json: Record<string, any>;
  rationale: string;
  uncertainty_note: string;
  evidence_record_ids_json: {
    alert_ids?: string[];
    case_ids?: string[];
    asset_ids?: string[];
    escalation_ids?: string[];
  };
  status: 'Open' | 'Under Review' | 'Closed';
  created_at: string;
  recommended_action: string;
}

export interface ReviewQueueItem {
  queue_item_id: string;
  run_id: string;
  entity_id: string;
  entity_name: string;
  alert_id?: string;
  case_id?: string;
  asset_id?: string;
  priority_score: number; // 0-100
  priority_band: PriorityBand;
  reason_finding_ids: string[];
  evidence_summary: string;
  review_status: ReviewStatus;
  examiner_comment: string;
  severity: AlertSeverity;
  impact?: ImpactLevel;
  created_at: string;
  details?: {
    closure_duration_seconds?: number;
    investigation_notes?: string;
    is_escalated?: boolean;
    peer_deviation?: string;
    anomaly_reason?: string;
  };
}

export interface AnalysisRunRecord {
  run_id: string;
  dataset_hash: string;
  normalized_dataset_hash: string;
  configuration_hash: string;
  ruleset_version: string;
  model_version: string;
  application_version: string;
  created_at: string;
  created_by: string;
  record_counts: {
    entities: number;
    assets: number;
    alerts: number;
    cases: number;
    escalations: number;
    findings: number;
    review_items: number;
  };
  warnings: string[];
}

export interface DataQualityIssue {
  id: string;
  rule_name: string;
  severity: 'High' | 'Medium' | 'Low';
  description: string;
  table_affected: string;
  affected_row_count: number;
  sample_identifiers: string[];
}

export interface DataQualityReport {
  overall_score: number; // 0 - 100
  total_records_analyzed: number;
  rejected_records_count: number;
  duplicate_ids_count: number;
  missing_timestamps_count: number;
  temporal_inversions_count: number;
  orphan_cases_count: number;
  orphan_escalations_count: number;
  unknown_assets_count: number;
  short_notes_count: number;
  issues: DataQualityIssue[];
}

export interface EntityRiskScore {
  entity_id: string;
  entity_name: string;
  sector: Sector;
  peer_group: string;
  reporting_period: string;
  rank: number;
  
  // Composite score: 0.40 * ExecutionGap + 0.35 * NegativeSpace + 0.15 * Trend + 0.10 * PeerDev
  overall_risk_score: number;
  prioritization_band: 'Low' | 'Moderate' | 'High' | 'Very High';
  
  execution_gap_score: number;
  negative_space_score: number;
  trend_deterioration_score: number;
  unexplained_peer_deviation_score: number;
  
  data_quality_score: number;
  confidence_label: 'High' | 'Medium' | 'Low' | 'Unavailable';
  
  active_assets_count: number;
  critical_assets_count: number;
  silent_critical_assets_count: number;
  total_alerts_count: number;
  critical_alerts_count: number;
  unresolved_critical_alerts: number;
  escalated_cases_count: number;
  median_closure_time_seconds: number;
}

export interface PeerBenchmarkMetric {
  metric_id: string;
  metric_name: string;
  entity_value: number;
  peer_median: number;
  peer_percentile: number; // 0 - 100
  peer_sample_size: number;
  unit: string;
  data_sufficiency_status: 'Sufficient' | 'Limited' | 'Insufficient';
  direction_of_concern: 'Higher' | 'Lower' | 'Both';
  interpretation: string;
}

export interface ExaminerAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole;
  action: string;
  target_id: string;
  details: string;
}

export interface GroundTruthEvaluation {
  dataset_label: string;
  total_alerts: number;
  total_entities: number;
  injected_issue_categories: number;
  review_queue_size: number;
  known_issue_entities_in_top_3: string;
  fast_close_recall: number;
  escalation_bypass_precision: number;
  repetitive_notes_f1: number;
  silent_asset_detection_rate: number;
  review_reduction_ratio: number;
}

export interface PeriodSnapshot {
  period: string;  // e.g., "2026-Q1"
  overall_risk_score: number;
  execution_gap_score: number;
  negative_space_score: number;
  total_alerts: number;
  critical_alerts: number;
  findings_count: number;
}

export interface EntityTrend {
  entity_id: string;
  entity_name: string;
  snapshots: PeriodSnapshot[];
  trend_direction: 'Improving' | 'Stable' | 'Deteriorating' | 'Insufficient Data';
  trend_delta: number;  // positive = worsening
  consecutive_deterioration_quarters: number;
}
