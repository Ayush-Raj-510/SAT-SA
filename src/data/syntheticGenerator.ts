/**
 * Synthetic Dataset Generator with Injected Ground-Truth Issues
 * Implements Section 19 of the SIH 26157 (NTRO / NCIIPC) Specification
 */

import {
  EntityRecord,
  AssetRecord,
  AlertRecord,
  CaseRecord,
  EscalationRecord,
  Sector,
  SizeBand,
  AssetCriticality,
  AlertSeverity,
  PeriodSnapshot
} from '../types';

export interface GroundTruthTag {
  entity_id: string;
  injected_issue_type: string;
  record_type: 'alert' | 'case' | 'asset' | 'coverage';
  target_id: string;
  description: string;
}

export interface SyntheticDataset {
  entities: EntityRecord[];
  assets: AssetRecord[];
  alerts: AlertRecord[];
  cases: CaseRecord[];
  escalations: EscalationRecord[];
  ground_truth_labels: GroundTruthTag[];
  historical_snapshots?: Record<string, PeriodSnapshot[]>;
  generation_timestamp: string;
  dataset_version: string;
}

export const SECTORS: Sector[] = [
  'Power & Energy',
  'Banking & Financial',
  'Telecommunications',
  'Civil Aviation & Transport',
  'Strategic & Defense',
  'Healthcare & Public Governance'
];

export const REPETITIVE_NOTES_CORPUS = [
  'Alert reviewed against network perimeter logs. Confirmed benign telemetry pulse. Closed as false positive.',
  'Investigated connection attempt. Host verified in local asset directory. Marked as false positive no action needed.',
  'Standard scheduled vulnerability scan detected. No anomalous behavior noted. Resolved without escalation.',
  'Automated signature trigger verified benign. Triage completed. Closing case.',
  'Reviewed and verified benign internal scanning routine. Closed.'
];

export function generateComprehensiveDataset(): SyntheticDataset {
  const entities: EntityRecord[] = [
    {
      entity_id: 'CSE-A',
      entity_name: 'National Power Grid Transmission Corp',
      sector: 'Power & Energy',
      size_band: 'Tier-1 Enterprise',
      peer_group: 'Critical Energy Infrastructure',
      reporting_period: '2026-Q3',
      source_file: 'cse_a_submission_2026q3.zip'
    },
    {
      entity_id: 'CSE-B',
      entity_name: 'Apex Clearing & Settlement Network',
      sector: 'Banking & Financial',
      size_band: 'Tier-1 Enterprise',
      peer_group: 'Systemically Important Financial',
      reporting_period: '2026-Q3',
      source_file: 'cse_b_submission_2026q3.zip'
    },
    {
      entity_id: 'CSE-C',
      entity_name: 'National Core Telecommunications',
      sector: 'Telecommunications',
      size_band: 'Tier-1 Enterprise',
      peer_group: 'Tier-1 Telecom Carriers',
      reporting_period: '2026-Q3',
      source_file: 'cse_c_submission_2026q3.zip'
    },
    {
      entity_id: 'CSE-D',
      entity_name: 'Civil Aviation Radar & Air Nav Services',
      sector: 'Civil Aviation & Transport',
      size_band: 'Tier-2 Major',
      peer_group: 'Aviation & Transit Control',
      reporting_period: '2026-Q3',
      source_file: 'cse_d_submission_2026q3.zip'
    },
    {
      entity_id: 'CSE-E',
      entity_name: 'Strategic Defense Research Lab',
      sector: 'Strategic & Defense',
      size_band: 'Tier-2 Major',
      peer_group: 'Strategic Defense Establishments',
      reporting_period: '2026-Q3',
      source_file: 'cse_e_submission_2026q3.zip'
    },
    {
      entity_id: 'CSE-F',
      entity_name: 'National Health & Governance Portal',
      sector: 'Healthcare & Public Governance',
      size_band: 'Tier-2 Major',
      peer_group: 'Public Health Governance',
      reporting_period: '2026-Q3',
      source_file: 'cse_f_submission_2026q3.zip'
    }
  ];

  const assets: AssetRecord[] = [];
  const alerts: AlertRecord[] = [];
  const cases: CaseRecord[] = [];
  const escalations: EscalationRecord[] = [];
  const ground_truth: GroundTruthTag[] = [];

  let alertSeq = 1000;
  let caseSeq = 5000;
  let escSeq = 8000;

  // 1. Generate Assets for each Entity
  entities.forEach((entity) => {
    const assetTypes = [
      { type: 'SCADA Master Terminal Unit', crit: 'Critical' as AssetCriticality, env: 'Internal OT' as const, ctrl: ['OT-NDR', 'Syslog', 'Firewall'] },
      { type: 'Core Active Directory Domain Controller', crit: 'Critical' as AssetCriticality, env: 'Production' as const, ctrl: ['EDR', 'ActiveDirectoryAudit', 'Syslog'] },
      { type: 'Financial Transaction Gateway', crit: 'Critical' as AssetCriticality, env: 'Production' as const, ctrl: ['WAF', 'EDR', 'DLP', 'NetFlow'] },
      { type: 'BGP Edge Autonomous Router', crit: 'Critical' as AssetCriticality, env: 'DMZ' as const, ctrl: ['NetFlow', 'BGP-Guard', 'Syslog'] },
      { type: 'Primary Operational Database Server', crit: 'High' as AssetCriticality, env: 'Production' as const, ctrl: ['DatabaseAudit', 'EDR'] },
      { type: 'Industrial RTU Sensor Cluster', crit: 'High' as AssetCriticality, env: 'Internal OT' as const, ctrl: ['OT-NDR'] },
      { type: 'Internal Proxy & Identity Gateway', crit: 'Medium' as AssetCriticality, env: 'Production' as const, ctrl: ['IdentityLog', 'WAF'] },
      { type: 'Corporate Workstation Subnet Gateway', crit: 'Low' as AssetCriticality, env: 'Internal OT' as const, ctrl: ['EDR'] }
    ];

    assetTypes.forEach((at, idx) => {
      const assetId = `AST-${entity.entity_id}-${101 + idx}`;
      assets.push({
        asset_id: assetId,
        entity_id: entity.entity_id,
        asset_name_hash: `hash_${assetId}_${(idx * 7919).toString(16)}`,
        asset_type: at.type,
        criticality: at.crit,
        environment: at.env,
        expected_controls: at.ctrl,
        active_from: '2025-01-01T00:00:00Z',
        source_file: `${entity.entity_id.toLowerCase()}_assets.csv`
      });
    });
  });

  // Helper date utility within 2026-Q3 (July - Sept 2026)
  const baseDate = new Date('2026-08-15T09:00:00Z');
  const addMinutes = (date: Date, mins: number) => new Date(date.getTime() + mins * 60000);
  const toISO = (date: Date) => date.toISOString();

  // 2. Populate Alerts & Operational Records with Injected Scenarios

  // --- CSE-A: Normal Baseline Entity ---
  // Balanced volume, realistic investigation times (25-50 min), proper escalations for criticals
  {
    const entityId = 'CSE-A';
    const cseAssets = assets.filter(a => a.entity_id === entityId);
    
    for (let i = 0; i < 45; i++) {
      alertSeq++;
      const alertId = `ALT-${alertSeq}`;
      const asset = cseAssets[i % cseAssets.length];
      const isCritical = i % 5 === 0;
      const isHigh = !isCritical && i % 3 === 0;
      const severity: AlertSeverity = isCritical ? 'Critical' : isHigh ? 'High' : 'Medium';
      
      const alertTime = addMinutes(baseDate, -i * 350);
      const ackTime = addMinutes(alertTime, 4 + (i % 8));
      const durationMins = 28 + (i % 30); // 28 to 58 minutes realistic closure
      const closeTime = addMinutes(alertTime, durationMins);

      let caseId: string | undefined = undefined;
      if (severity === 'Critical' || severity === 'High' || i % 2 === 0) {
        caseSeq++;
        caseId = `CASE-${caseSeq}`;

        const caseTime = addMinutes(ackTime, 2);
        cases.push({
          case_id: caseId,
          entity_id: entityId,
          alert_id: alertId,
          investigator_id_hash: `inv_${100 + (i % 4)}`,
          investigation_started_at: toISO(caseTime),
          investigation_completed_at: toISO(closeTime),
          impact: severity === 'Critical' ? 'Critical' : 'High',
          closure_reason: 'Remediated & Verified Baseline',
          investigation_notes: `Investigator analyzed endpoint execution tree, reviewed netflow spikes from ${asset.asset_type}, confirmed lateral movement containment, and reset credentials.`,
          source_row_number: i + 1
        });

        // Legitimate escalation for critical cases
        if (severity === 'Critical') {
          escSeq++;
          escalations.push({
            escalation_id: `ESC-${escSeq}`,
            case_id: caseId,
            escalation_type: 'Tier-2 Escalation',
            escalated_at: toISO(addMinutes(caseTime, 12)),
            recipient_role: 'NCIIPC Sectoral Lead & Incident Response Team',
            outcome: 'Remediated',
            source_row_number: escalations.length + 1
          });
        }
      }

      alerts.push({
        alert_id: alertId,
        entity_id: entityId,
        asset_id: asset.asset_id,
        alert_category: isCritical ? 'Privilege Escalation on SCADA Gateway' : 'Suspicious Remote PowerShell Execution',
        source_control: asset.expected_controls[0] || 'EDR',
        severity: severity,
        created_at: toISO(alertTime),
        acknowledged_at: toISO(ackTime),
        closed_at: toISO(closeTime),
        disposition: isCritical ? 'True Positive' : 'Benign',
        case_id: caseId,
        source_row_number: i + 1
      });
    }
  }

  // --- CSE-B: Fast Closure & Repetitive Boilerplate Investigation Notes ---
  // Injected: Alerts closed in 20-75 seconds without triage; identical copy-paste notes
  {
    const entityId = 'CSE-B';
    const cseAssets = assets.filter(a => a.entity_id === entityId);
    
    for (let i = 0; i < 50; i++) {
      alertSeq++;
      const alertId = `ALT-${alertSeq}`;
      const asset = cseAssets[i % cseAssets.length];
      const isCriticalOrHigh = i % 2 === 0;
      const severity: AlertSeverity = isCriticalOrHigh ? (i % 4 === 0 ? 'Critical' : 'High') : 'Medium';
      
      const alertTime = addMinutes(baseDate, -i * 200);
      const ackTime = addMinutes(alertTime, 1);
      
      // INJECTED ISSUE: Fast closure (25s to 75s)
      const durationSeconds = 25 + (i % 50);
      const closeTime = new Date(alertTime.getTime() + durationSeconds * 1000);

      caseSeq++;
      const caseId = `CASE-${caseSeq}`;

      // INJECTED ISSUE: Repetitive copy-paste boilerplate note
      const boilerplateNote = REPETITIVE_NOTES_CORPUS[0]; // identical note repeated dozens of times!

      cases.push({
        case_id: caseId,
        entity_id: entityId,
        alert_id: alertId,
        investigator_id_hash: 'inv_b_single_analyst', // Same analyst rubber-stamping everything
        investigation_started_at: toISO(addMinutes(alertTime, 0.2)),
        investigation_completed_at: toISO(closeTime),
        impact: 'High',
        closure_reason: 'False Positive',
        investigation_notes: boilerplateNote,
        source_row_number: i + 1
      });

      alerts.push({
        alert_id: alertId,
        entity_id: entityId,
        asset_id: asset.asset_id,
        alert_category: 'SWIFT Terminal Unauthorized RPC Invocation',
        source_control: 'Financial-Transaction-Monitor',
        severity: severity,
        created_at: toISO(alertTime),
        acknowledged_at: toISO(ackTime),
        closed_at: toISO(closeTime),
        disposition: 'False Positive',
        case_id: caseId,
        source_row_number: i + 1
      });

      if (isCriticalOrHigh) {
        ground_truth.push({
          entity_id: entityId,
          injected_issue_type: 'fast_closure',
          record_type: 'alert',
          target_id: alertId,
          description: `High/Critical alert ${alertId} closed in ${durationSeconds} seconds with zero investigation depth.`
        });
        ground_truth.push({
          entity_id: entityId,
          injected_issue_type: 'repetitive_notes',
          record_type: 'case',
          target_id: caseId,
          description: `Identical boilerplate investigation note stamped across multiple disparate assets.`
        });
      }
    }
  }

  // --- CSE-C: Critical Alerts Without Escalation (Escalation Bypass) ---
  // Injected: High & Critical alerts closed without mandatory Tier-2 / CISO escalation
  {
    const entityId = 'CSE-C';
    const cseAssets = assets.filter(a => a.entity_id === entityId);
    
    for (let i = 0; i < 40; i++) {
      alertSeq++;
      const alertId = `ALT-${alertSeq}`;
      const asset = cseAssets[i % cseAssets.length];
      const isCritical = i % 3 === 0;
      const severity: AlertSeverity = isCritical ? 'Critical' : 'High';
      
      const alertTime = addMinutes(baseDate, -i * 280);
      const ackTime = addMinutes(alertTime, 10);
      const closeTime = addMinutes(alertTime, 95);

      caseSeq++;
      const caseId = `CASE-${caseSeq}`;

      cases.push({
        case_id: caseId,
        entity_id: entityId,
        alert_id: alertId,
        investigator_id_hash: `inv_c_${10 + (i % 3)}`,
        investigation_started_at: toISO(ackTime),
        investigation_completed_at: toISO(closeTime),
        impact: isCritical ? 'Critical' : 'High',
        closure_reason: 'Closed Internally',
        investigation_notes: 'BGP autonomous system route withdrawal observed on core edge. Traffic rerouted. Case marked closed without external notification.',
        source_row_number: i + 1
      });

      // INJECTED ISSUE: NO ESCALATION RECORD CREATED FOR CRITICAL INCIDENTS!
      // In a normal baseline, critical BGP/Core telecom incidents MUST have an EscalationRecord.

      alerts.push({
        alert_id: alertId,
        entity_id: entityId,
        asset_id: asset.asset_id,
        alert_category: isCritical ? 'BGP Autonomous System Hijack Attempt' : 'Core Optical Fiber Degradation Telemetry',
        source_control: 'Carrier-BGP-Guard',
        severity: severity,
        created_at: toISO(alertTime),
        acknowledged_at: toISO(ackTime),
        closed_at: toISO(closeTime),
        disposition: 'True Positive',
        case_id: caseId,
        source_row_number: i + 1
      });

      if (isCritical) {
        ground_truth.push({
          entity_id: entityId,
          injected_issue_type: 'escalation_bypass',
          record_type: 'case',
          target_id: caseId,
          description: `Critical alert ${alertId} with high impact had no linked escalation record, violating mandated incident reporting policy.`
        });
      }
    }
  }

  // --- CSE-D: Sudden Telemetry / Coverage Drop ---
  // Injected: Entity has only 5 total alerts in Q3, whereas baseline expectation is 120+ alerts
  {
    const entityId = 'CSE-D';
    const cseAssets = assets.filter(a => a.entity_id === entityId);
    
    // Only 5 sporadic alerts generated in Q3 - a massive 85% drop from expected volume!
    for (let i = 0; i < 5; i++) {
      alertSeq++;
      const alertId = `ALT-${alertSeq}`;
      const asset = cseAssets[0]; // Only hits one single asset
      
      const alertTime = addMinutes(baseDate, -i * 5000);
      const ackTime = addMinutes(alertTime, 20);
      const closeTime = addMinutes(alertTime, 60);

      alerts.push({
        alert_id: alertId,
        entity_id: entityId,
        asset_id: asset.asset_id,
        alert_category: 'ADS-B Radar Stream Ping Delay',
        source_control: 'Radar-Integrity-Agent',
        severity: 'Low',
        created_at: toISO(alertTime),
        acknowledged_at: toISO(ackTime),
        closed_at: toISO(closeTime),
        disposition: 'Benign',
        source_row_number: i + 1
      });
    }

    ground_truth.push({
      entity_id: entityId,
      injected_issue_type: 'coverage_drop',
      record_type: 'coverage',
      target_id: entityId,
      description: 'Abrupt 85%+ coverage drop in Q3 alerts compared to historical baseline. Critical ATC radars unmonitored.'
    });
  }

  // --- CSE-E: Silent Critical Assets & Peer-Relative Low Activity ---
  // Injected: Key Critical classified assets have ZERO alerts/activity for entire period
  {
    const entityId = 'CSE-E';
    const cseAssets = assets.filter(a => a.entity_id === entityId);
    // Critical asset AST-CSE-E-101 and AST-CSE-E-102 remain COMPLETELY SILENT (0 alerts)
    const silentCriticalAsset = cseAssets[0]; // SCADA Master Terminal Unit
    const silentDomainController = cseAssets[1]; // Core AD DC

    ground_truth.push({
      entity_id: entityId,
      injected_issue_type: 'silent_critical_asset',
      record_type: 'asset',
      target_id: silentCriticalAsset.asset_id,
      description: `Critical SCADA Master Terminal ${silentCriticalAsset.asset_id} produced ZERO alerts or telemetry records across the entire 90-day period.`
    });
    ground_truth.push({
      entity_id: entityId,
      injected_issue_type: 'silent_critical_asset',
      record_type: 'asset',
      target_id: silentDomainController.asset_id,
      description: `Critical Active Directory Domain Controller ${silentDomainController.asset_id} produced ZERO alerts despite 14 external authentication requests.`
    });

    // Generate low volume only on non-critical low-tier assets
    for (let i = 0; i < 8; i++) {
      alertSeq++;
      const alertId = `ALT-${alertSeq}`;
      const asset = cseAssets[cseAssets.length - 1]; // Low priority corporate subnet
      
      const alertTime = addMinutes(baseDate, -i * 1200);
      const ackTime = addMinutes(alertTime, 45);
      const closeTime = addMinutes(alertTime, 120);

      alerts.push({
        alert_id: alertId,
        entity_id: entityId,
        asset_id: asset.asset_id,
        alert_category: 'Windows Defender Signature Update Failure',
        source_control: 'EDR',
        severity: 'Low',
        created_at: toISO(alertTime),
        acknowledged_at: toISO(ackTime),
        closed_at: toISO(closeTime),
        disposition: 'Benign',
        source_row_number: i + 1
      });
    }
  }

  // --- CSE-F: Data-Quality & Relationship Errors ---
  // Injected: Illogical timestamps (close before open), orphan cases, duplicate IDs, missing notes
  {
    const entityId = 'CSE-F';
    const cseAssets = assets.filter(a => a.entity_id === entityId);
    
    for (let i = 0; i < 25; i++) {
      alertSeq++;
      let alertId = `ALT-${alertSeq}`;
      const asset = cseAssets[i % cseAssets.length];
      
      const alertTime = addMinutes(baseDate, -i * 300);
      let closeTime = addMinutes(alertTime, 45);
      let ackTime = addMinutes(alertTime, 10);

      // INJECTED DATA QUALITY ISSUE 1: Inverted timestamps (close time earlier than create time)
      if (i === 3 || i === 7) {
        closeTime = addMinutes(alertTime, -55); // Closed 55 minutes BEFORE it was created!
        ground_truth.push({
          entity_id: entityId,
          injected_issue_type: 'data_quality_temporal_inversion',
          record_type: 'alert',
          target_id: alertId,
          description: `Temporal inversion: alert ${alertId} closed_at timestamp is earlier than created_at.`
        });
      }

      // INJECTED DATA QUALITY ISSUE 2: Duplicate Alert ID
      if (i === 5) {
        alertId = 'ALT-1005'; // duplicates existing alert
        ground_truth.push({
          entity_id: entityId,
          injected_issue_type: 'data_quality_duplicate_id',
          record_type: 'alert',
          target_id: alertId,
          description: `Duplicate alert ID ${alertId} submitted in batch.`
        });
      }

      caseSeq++;
      const caseId = `CASE-${caseSeq}`;

      // INJECTED DATA QUALITY ISSUE 3: Orphan case referencing nonexistent alert
      let caseAlertRef = alertId;
      if (i === 11) {
        caseAlertRef = 'ALT-NONEXISTENT-9999';
        ground_truth.push({
          entity_id: entityId,
          injected_issue_type: 'data_quality_orphan_case',
          record_type: 'case',
          target_id: caseId,
          description: `Orphan case ${caseId} references non-existent alert ${caseAlertRef}.`
        });
      }

      // INJECTED DATA QUALITY ISSUE 4: Missing / truncated investigation notes (<10 chars)
      const investigationNote = (i === 4 || i === 8) 
        ? 'ok' 
        : 'Healthcare database telemetry verified and patient registry access validated.';

      cases.push({
        case_id: caseId,
        entity_id: entityId,
        alert_id: caseAlertRef,
        investigator_id_hash: i === 6 ? '' : `inv_f_${i % 2}`, // missing investigator hash on i===6
        investigation_started_at: toISO(ackTime),
        investigation_completed_at: toISO(closeTime),
        impact: 'Medium',
        closure_reason: 'Resolved',
        investigation_notes: investigationNote,
        source_row_number: i + 1
      });

      alerts.push({
        alert_id: alertId,
        entity_id: entityId,
        asset_id: i === 9 ? 'AST-UNKNOWN-999' : asset.asset_id, // INJECTED: Unknown asset reference
        alert_category: 'EHR Database Mass Query Export',
        source_control: 'DatabaseAudit',
        severity: 'High',
        created_at: toISO(alertTime),
        acknowledged_at: toISO(ackTime),
        closed_at: toISO(closeTime),
        disposition: 'True Positive',
        case_id: caseId,
        source_row_number: i + 1
      });
    }
  }

  // --- Generate Historical Snapshots for Multi-Period Trend Analysis ---
  const historical_snapshots: Record<string, PeriodSnapshot[]> = {};
  
  entities.forEach(ent => {
    // Base scores that will be adjusted based on the entity's storyline
    let baseRisk = 20;
    let baseExec = 15;
    let baseNeg = 10;
    let baseAlerts = 120;
    
    if (ent.entity_id === 'CSE-A') {
      // Stable/Improving
      historical_snapshots[ent.entity_id] = [
        { period: '2025-Q4', overall_risk_score: 35, execution_gap_score: 40, negative_space_score: 25, total_alerts: 110, critical_alerts: 8, findings_count: 3 },
        { period: '2026-Q1', overall_risk_score: 28, execution_gap_score: 30, negative_space_score: 20, total_alerts: 105, critical_alerts: 6, findings_count: 2 },
        { period: '2026-Q2', overall_risk_score: 22, execution_gap_score: 18, negative_space_score: 15, total_alerts: 115, critical_alerts: 5, findings_count: 1 }
      ];
    } else if (ent.entity_id === 'CSE-D') {
      // Deteriorating (Coverage Drop)
      historical_snapshots[ent.entity_id] = [
        { period: '2025-Q4', overall_risk_score: 30, execution_gap_score: 20, negative_space_score: 15, total_alerts: 145, critical_alerts: 12, findings_count: 2 },
        { period: '2026-Q1', overall_risk_score: 45, execution_gap_score: 30, negative_space_score: 40, total_alerts: 80, critical_alerts: 8, findings_count: 4 },
        { period: '2026-Q2', overall_risk_score: 68, execution_gap_score: 45, negative_space_score: 75, total_alerts: 35, critical_alerts: 2, findings_count: 7 }
      ];
    } else if (ent.entity_id === 'CSE-B') {
      // Fast closing (High Execution Gap)
      historical_snapshots[ent.entity_id] = [
        { period: '2025-Q4', overall_risk_score: 65, execution_gap_score: 80, negative_space_score: 30, total_alerts: 200, critical_alerts: 15, findings_count: 5 },
        { period: '2026-Q1', overall_risk_score: 62, execution_gap_score: 78, negative_space_score: 28, total_alerts: 210, critical_alerts: 18, findings_count: 5 },
        { period: '2026-Q2', overall_risk_score: 68, execution_gap_score: 85, negative_space_score: 32, total_alerts: 195, critical_alerts: 16, findings_count: 6 }
      ];
    } else {
      // Generic oscillating
      historical_snapshots[ent.entity_id] = [
        { period: '2025-Q4', overall_risk_score: 45, execution_gap_score: 40, negative_space_score: 30, total_alerts: 130, critical_alerts: 10, findings_count: 4 },
        { period: '2026-Q1', overall_risk_score: 55, execution_gap_score: 50, negative_space_score: 40, total_alerts: 140, critical_alerts: 14, findings_count: 6 },
        { period: '2026-Q2', overall_risk_score: 50, execution_gap_score: 45, negative_space_score: 35, total_alerts: 125, critical_alerts: 9, findings_count: 5 }
      ];
    }
  });

  return {
    entities,
    assets,
    alerts,
    cases,
    escalations,
    ground_truth_labels: ground_truth,
    historical_snapshots,
    generation_timestamp: new Date().toISOString(),
    dataset_version: 'v2026.3-INJECTED-GOLD'
  };
}
