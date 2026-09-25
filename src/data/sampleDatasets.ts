import JSZip from 'jszip';

/**
 * Pre-configured realistic SOC data files and CSV/JSON templates
 * for instant testing and download.
 */

export const SAMPLE_ALERTS_CSV = `alert_id,entity_id,asset_id,alert_category,source_control,severity,created_at,acknowledged_at,closed_at,disposition,case_id
ALT-NCIIPC-001,CSE-A,AST-CSE-A-01,SCADA Substation Transformer Frequency Surge,OT-NDR-Sensor,High,2026-09-02T16:30:00Z,2026-09-02T16:35:00Z,2026-09-02T17:15:00Z,True Positive,CASE-NCIIPC-001
ALT-NCIIPC-002,CSE-A,AST-CSE-A-02,RTU Firmware Checksum Hash Mismatch,OT-Integrity,Critical,2026-09-03T02:00:00Z,2026-09-03T02:10:00Z,2026-09-03T03:30:00Z,True Positive,CASE-NCIIPC-002
ALT-NCIIPC-003,CSE-B,AST-CSE-B-01,SWIFT Terminal Unauthorized RPC Call,Financial-Monitor,Critical,2026-09-01T08:15:00Z,2026-09-01T08:15:10Z,2026-09-01T08:15:42Z,False Positive,CASE-NCIIPC-003
ALT-NCIIPC-004,CSE-B,AST-CSE-B-02,Core BGP Route Announcement Mismatch,Carrier-Guard,Critical,2026-09-01T09:20:00Z,2026-09-01T09:20:05Z,2026-09-01T09:20:38Z,False Positive,CASE-NCIIPC-004
ALT-NCIIPC-005,CSE-B,AST-CSE-B-03,Active Directory DCSync Attack Sequence,CrowdStrike-EDR,Critical,2026-09-01T10:05:00Z,2026-09-01T10:05:12Z,2026-09-01T10:05:50Z,False Positive,CASE-NCIIPC-005
ALT-NCIIPC-006,CSE-C,AST-CSE-C-01,Inter-Bank Clearing Switch Memory Dump,Host-Forensics,Critical,2026-09-02T11:30:00Z,2026-09-02T11:35:00Z,2026-09-02T13:45:00Z,True Positive,CASE-NCIIPC-006
ALT-NCIIPC-007,CSE-C,AST-CSE-C-02,Database Cryptographic Key Exfiltration,DLP-Monitor,Critical,2026-09-02T14:10:00Z,2026-09-02T14:15:00Z,2026-09-02T16:00:00Z,True Positive,CASE-NCIIPC-007
ALT-NCIIPC-008,CSE-D,AST-CSE-D-01,Radar Display Terminal Buffer Overflow,Air-Traffic-NIDS,Critical,2026-09-03T06:30:00Z,2026-09-03T06:35:00Z,2026-09-03T08:00:00Z,True Positive,CASE-NCIIPC-008`;

export const SAMPLE_CASES_CSV = `case_id,entity_id,alert_id,investigator_id_hash,investigation_started_at,investigation_completed_at,impact,closure_reason,investigation_notes
CASE-NCIIPC-001,CSE-A,ALT-NCIIPC-001,ANL-108,2026-09-02T16:35:00Z,2026-09-02T17:15:00Z,Medium,Operational adjustment verified,Frequency deviation caused by legitimate grid switching operational command. Operator verified.
CASE-NCIIPC-002,CSE-A,ALT-NCIIPC-002,ANL-108,2026-09-03T02:10:00Z,2026-09-03T03:30:00Z,High,Emergency firmware signed,Field technician uploaded emergency patch without change ticket. Verified against vendor manifest.
CASE-NCIIPC-003,CSE-B,ALT-NCIIPC-003,ANL-409,2026-09-01T08:15:10Z,2026-09-01T08:15:42Z,Critical,Closed as false positive,Alert reviewed against network perimeter logs. Confirmed benign telemetry pulse. Closed as false positive.
CASE-NCIIPC-004,CSE-B,ALT-NCIIPC-004,ANL-409,2026-09-01T09:20:05Z,2026-09-01T09:20:38Z,High,Closed as false positive,Alert reviewed against network perimeter logs. Confirmed benign telemetry pulse. Closed as false positive.
CASE-NCIIPC-005,CSE-B,ALT-NCIIPC-005,ANL-409,2026-09-01T10:05:12Z,2026-09-01T10:05:50Z,Critical,Closed as false positive,Alert reviewed against network perimeter logs. Confirmed benign telemetry pulse. Closed as false positive.
CASE-NCIIPC-006,CSE-C,ALT-NCIIPC-006,ANL-201,2026-09-02T11:35:00Z,2026-09-02T13:45:00Z,Critical,Gateway isolated,Extracted memory core. Injected payload hijacked payment gateway socket. Isolated server immediately.
CASE-NCIIPC-007,CSE-C,ALT-NCIIPC-007,ANL-201,2026-09-02T14:15:00Z,2026-09-02T16:00:00Z,Critical,Firewall ACL updated,Outbound TLS tunnel terminated to unknown overseas IP. Blocked firewall port and revoked Master Key.
CASE-NCIIPC-008,CSE-D,ALT-NCIIPC-008,ANL-312,2026-09-03T06:35:00Z,2026-09-03T08:00:00Z,Critical,Input sanitizer applied,Crafted network packet triggered crash on legacy radar switch. Patched input sanitizer.`;

export const SAMPLE_ASSETS_CSV = `asset_id,entity_id,asset_name_hash,asset_type,criticality,environment,expected_controls,active_from
AST-CSE-A-01,CSE-A,HASH-TRANSFORMER-CTRL,Power Grid Substation Transformer RTU,Critical,Internal OT,EDR|NDR|Syslog,2026-01-01T00:00:00Z
AST-CSE-A-02,CSE-A,HASH-RTU-FIRMWARE,Substation Gateway Remote Terminal Unit,Critical,Internal OT,OT-NDR|Integrity-Guard,2026-01-01T00:00:00Z
AST-CSE-B-01,CSE-B,HASH-SWIFT-NODE,SWIFT Financial Transaction Messaging Switch,Critical,Production,EDR|NetFlow|DLP,2026-01-01T00:00:00Z
AST-CSE-B-02,CSE-B,HASH-BGP-ROUTER,Autonomous System Border Gateway Router,High,Production,BGP-Guard|Syslog,2026-01-01T00:00:00Z
AST-CSE-B-03,CSE-B,HASH-DC-ROOT,Tier-0 Domain Controller Primary KDC,Critical,Production,CrowdStrike-EDR|Identity-Guard,2026-01-01T00:00:00Z
AST-CSE-C-01,CSE-C,HASH-CLEARING-SW,National Inter-Bank Clearing Core Host,Critical,Production,EDR|Memory-Guard,2026-01-01T00:00:00Z
AST-CSE-C-02,CSE-C,HASH-DB-CORE,Custody Transaction Database Cluster,Critical,Production,DLP|Database-Audit,2026-01-01T00:00:00Z
AST-CSE-D-01,CSE-D,HASH-RADAR-DISP,Air Route Traffic Control Primary Radar Console,Critical,Production,Air-Traffic-NIDS|Host-Guard,2026-01-01T00:00:00Z`;

export const SAMPLE_ENTITIES_CSV = `entity_id,entity_name,sector,size_band,peer_group,reporting_period
CSE-A,National Power Grid Transmission Corp,Power & Energy,Tier-1 Enterprise,Power & Energy Peers,2026-Q3
CSE-B,State Sovereign Bank & Financial Clearing,Banking & Financial,Tier-1 Enterprise,Banking & Financial Peers,2026-Q3
CSE-C,Apex Securities Settlement Clearing House,Banking & Financial,Tier-1 Enterprise,Banking & Financial Peers,2026-Q3
CSE-D,National Civil Aviation Traffic Control Authority,Civil Aviation & Transport,Tier-1 Enterprise,Civil Aviation Peers,2026-Q3`;

export const SAMPLE_ESCALATIONS_CSV = `escalation_id,case_id,escalation_type,escalated_at,recipient_role,outcome
ESC-NCIIPC-001,CASE-NCIIPC-002,Tier-2 Escalation,2026-09-03T02:30:00Z,OT Operations Safety Board,Remediated
ESC-NCIIPC-002,CASE-NCIIPC-003,CISO Notification,2026-09-01T08:15:30Z,Chief Information Security Officer,Acknowledged
ESC-NCIIPC-003,CASE-NCIIPC-006,CERT-In Reporting,2026-09-02T12:00:00Z,Indian Computer Emergency Response Team,Investigating
ESC-NCIIPC-004,CASE-NCIIPC-007,CERT-In Reporting,2026-09-02T14:45:00Z,Indian Computer Emergency Response Team,Remediated
ESC-NCIIPC-005,CASE-NCIIPC-008,Emergency Containment,2026-09-03T07:00:00Z,Air Traffic Directorate CISO,Remediated`;

export async function createSampleZipBlob(): Promise<Blob> {
  const zip = new JSZip();
  zip.file('alerts.csv', SAMPLE_ALERTS_CSV);
  zip.file('cases.csv', SAMPLE_CASES_CSV);
  zip.file('assets.csv', SAMPLE_ASSETS_CSV);
  zip.file('entities.csv', SAMPLE_ENTITIES_CSV);
  zip.file('escalations.csv', SAMPLE_ESCALATIONS_CSV);
  zip.file('manifest.txt', `NCIIPC SOC Multi-Table Submission Archive
------------------------------------------
Format: Section 8 & Section 19 SIH 26157 Statutory Submission
Generated: 2026-Q3 Supervisory Cycle
Included Files:
- alerts.csv (8 core alerts)
- cases.csv (8 investigation cases linked to alerts)
- assets.csv (8 critical CII monitored assets)
- entities.csv (4 Critical Sector Entities)
- escalations.csv (5 statutory escalations)
`);
  return await zip.generateAsync({ type: 'blob' });
}

export const SAMPLE_RANSOMWARE_CSV = `alert_id,entity_id,asset_id,alert_category,source_control,severity,created_at,closed_at,disposition,investigation_notes,analyst,impact,escalation_type
RW-01,CSE-E,AST-CSE-E-101,BlackCat Encryptor Dropper Detected,SentinelOne,Critical,2026-09-03T01:10:00Z,2026-09-03T01:11:05Z,False Positive,Standard scheduled vulnerability scan detected. No anomalous behavior noted. Resolved without escalation.,ANL-888,Critical,
RW-02,CSE-E,AST-CSE-E-102,PsExec Lateral Movement to Domain Controller,EDR-Sensor,Critical,2026-09-03T01:15:00Z,2026-09-03T01:16:10Z,False Positive,Standard scheduled vulnerability scan detected. No anomalous behavior noted. Resolved without escalation.,ANL-888,Critical,
RW-03,CSE-E,AST-CSE-E-103,Mass File Renaming with .enc Extension,File-Integrity,Critical,2026-09-03T01:20:00Z,2026-09-03T01:21:00Z,False Positive,Standard scheduled vulnerability scan detected. No anomalous behavior noted. Resolved without escalation.,ANL-888,Critical,
RW-04,CSE-E,AST-CSE-E-104,Exfiltration of Refinery Safety Configurations,NDR-Zeek,Critical,2026-09-03T01:25:00Z,2026-09-03T01:25:55Z,False Positive,Standard scheduled vulnerability scan detected. No anomalous behavior noted. Resolved without escalation.,ANL-888,Critical,
RW-05,CSE-B,AST-CSE-B-101,LockBit Beaconing to C2 IP 198.51.100.44,Firewall-PaloAlto,High,2026-09-03T02:00:00Z,2026-09-03T02:00:40Z,False Positive,Standard scheduled vulnerability scan detected. No anomalous behavior noted. Resolved without escalation.,ANL-888,High,`;

export const SAMPLE_JSON_DATASET = {
  entities: [
    {
      entity_id: 'CSE-ALPHA',
      entity_name: 'Metro Unified Power & Grid Corporation',
      sector: 'Power & Energy',
      size_band: 'Tier-1 Enterprise',
      peer_group: 'Power & Energy Peers',
      reporting_period: '2026-Q3',
      source_file: 'sample_enclave_submission.json'
    },
    {
      entity_id: 'CSE-BETA',
      entity_name: 'Apex National Telecom Fiber Backbone',
      sector: 'Telecommunications',
      size_band: 'Tier-1 Enterprise',
      peer_group: 'Telecommunications Peers',
      reporting_period: '2026-Q3',
      source_file: 'sample_enclave_submission.json'
    },
    {
      entity_id: 'CSE-GAMMA',
      entity_name: 'Sovereign Clearing & Settlement Exchange',
      sector: 'Banking & Financial',
      size_band: 'Tier-1 Enterprise',
      peer_group: 'Banking & Financial Peers',
      reporting_period: '2026-Q3',
      source_file: 'sample_enclave_submission.json'
    }
  ],
  assets: [
    {
      asset_id: 'AST-ALP-001',
      entity_id: 'CSE-ALPHA',
      asset_name_hash: 'HASH-SCADA-CTRL',
      asset_type: 'SCADA Master Substation Controller',
      criticality: 'Critical',
      environment: 'Internal OT',
      expected_controls: ['EDR', 'NDR', 'Syslog'],
      active_from: '2026-01-01T00:00:00Z',
      source_file: 'sample_enclave_submission.json'
    },
    {
      asset_id: 'AST-ALP-002',
      entity_id: 'CSE-ALPHA',
      asset_name_hash: 'HASH-HVDC-GATE',
      asset_type: 'HVDC Grid Inverter RTU',
      criticality: 'Critical',
      environment: 'Internal OT',
      expected_controls: ['OT-NDR'],
      active_from: '2026-01-01T00:00:00Z',
      source_file: 'sample_enclave_submission.json'
    },
    {
      asset_id: 'AST-BET-001',
      entity_id: 'CSE-BETA',
      asset_name_hash: 'HASH-BGP-CORE',
      asset_type: 'Core 5G Backbone Router',
      criticality: 'Critical',
      environment: 'Production',
      expected_controls: ['NetFlow', 'BGP-Guard'],
      active_from: '2026-01-01T00:00:00Z',
      source_file: 'sample_enclave_submission.json'
    },
    {
      asset_id: 'AST-GAM-001',
      entity_id: 'CSE-GAMMA',
      asset_name_hash: 'HASH-SWIFT-NODE',
      asset_type: 'SWIFT Gateway Payment Switch',
      criticality: 'Critical',
      environment: 'Production',
      expected_controls: ['EDR', 'Syslog', 'DLP'],
      active_from: '2026-01-01T00:00:00Z',
      source_file: 'sample_enclave_submission.json'
    }
  ],
  alerts: [
    {
      alert_id: 'ALT-ALP-01',
      entity_id: 'CSE-ALPHA',
      asset_id: 'AST-ALP-001',
      alert_category: 'SCADA DNP3 Protocol Inversion',
      source_control: 'OT-NDR',
      severity: 'Critical',
      created_at: '2026-09-02T10:00:00Z',
      closed_at: '2026-09-02T11:15:00Z',
      disposition: 'True Positive',
      case_id: 'CASE-ALP-01',
      source_row_number: 1
    },
    {
      alert_id: 'ALT-BET-01',
      entity_id: 'CSE-BETA',
      asset_id: 'AST-BET-001',
      alert_category: 'Unauthorized BGP Route Injection',
      source_control: 'BGP-Guard',
      severity: 'Critical',
      created_at: '2026-09-02T12:00:00Z',
      closed_at: '2026-09-02T12:00:35Z',
      disposition: 'False Positive',
      case_id: 'CASE-BET-01',
      source_row_number: 2
    },
    {
      alert_id: 'ALT-GAM-01',
      entity_id: 'CSE-GAMMA',
      asset_id: 'AST-GAM-001',
      alert_category: 'Payment Switch Rogue Memory Injection',
      source_control: 'EDR',
      severity: 'Critical',
      created_at: '2026-09-02T14:00:00Z',
      closed_at: '2026-09-02T16:30:00Z',
      disposition: 'True Positive',
      case_id: 'CASE-GAM-01',
      source_row_number: 3
    }
  ],
  cases: [
    {
      case_id: 'CASE-ALP-01',
      entity_id: 'CSE-ALPHA',
      alert_id: 'ALT-ALP-01',
      investigator_id_hash: 'ANL-DIR-GRID',
      investigation_started_at: '2026-09-02T10:05:00Z',
      investigation_completed_at: '2026-09-02T11:15:00Z',
      impact: 'High',
      closure_reason: 'Emergency isolated OT switch',
      investigation_notes: 'Investigated remote command injection on master substation. Host air-gapped; firmware rolled back.',
      source_row_number: 1
    },
    {
      case_id: 'CASE-BET-01',
      entity_id: 'CSE-BETA',
      alert_id: 'ALT-BET-01',
      investigator_id_hash: 'ANL-FAST-TRIAGE',
      investigation_started_at: '2026-09-02T12:00:00Z',
      investigation_completed_at: '2026-09-02T12:00:35Z',
      impact: 'Critical',
      closure_reason: 'Closed as false positive',
      investigation_notes: 'Alert reviewed against network perimeter logs. Confirmed benign telemetry pulse. Closed as false positive.',
      source_row_number: 2
    },
    {
      case_id: 'CASE-GAM-01',
      entity_id: 'CSE-GAMMA',
      alert_id: 'ALT-GAM-01',
      investigator_id_hash: 'ANL-SWIFT-IR',
      investigation_started_at: '2026-09-02T14:05:00Z',
      investigation_completed_at: '2026-09-02T16:30:00Z',
      impact: 'Critical',
      closure_reason: 'Breach remediated',
      investigation_notes: 'Rogue payload attempted unauthorized SWIFT pacs.008 credit transfer. Process killed and reported to CERT-In.',
      source_row_number: 3
    }
  ],
  escalations: [
    {
      escalation_id: 'ESC-GAM-01',
      case_id: 'CASE-GAM-01',
      escalation_type: 'CERT-In Reporting',
      escalated_at: '2026-09-02T14:30:00Z',
      recipient_role: 'National Cyber Security Coordinator (NCSC)',
      outcome: 'Remediated',
      source_row_number: 1
    }
  ],
  ground_truth_labels: [],
  generation_timestamp: new Date().toISOString(),
  dataset_version: 'NCIIPC-ENCLAVE-2026Q3'
};
