import React from 'react';
import { Download, Lock, Hash } from 'lucide-react';
import { AnalysisRunRecord, ExaminerAuditEntry, UserRole, UserProfile } from '../types';
import { PageHeader, Panel, Stat, CopyButton, EmptyState } from './ui';
import { formatTimestamp } from '../engine/format';

interface AuditTabProps {
  currentRun: AnalysisRunRecord;
  auditTrail: ExaminerAuditEntry[];
  userRole: UserRole;
  currentUser?: UserProfile;
  onClearLogs?: () => void;
}

export const AuditTab: React.FC<AuditTabProps> = ({
  currentRun,
  auditTrail,
  userRole,
  currentUser,
}) => {
  const canExport = userRole !== 'Read-only Reviewer';

  const exportAuditManifest = () => {
    const manifest = {
      run_id: currentRun.run_id,
      timestamp: currentRun.created_at,
      ruleset_version: currentRun.ruleset_version,
      application_version: currentRun.application_version,
      dataset_sha256: currentRun.dataset_hash,
      normalized_dataset_sha256: currentRun.normalized_dataset_hash,
      configuration_sha256: currentRun.configuration_hash,
      record_counts: currentRun.record_counts,
      examiner_activity_trail: auditTrail,
    };

    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sat_sa_run_manifest_${currentRun.run_id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const hashes: { label: string; value: string; note: string }[] = [
    {
      label: 'Raw dataset SHA-256',
      value: currentRun.dataset_hash,
      note: 'Digest of the ingested submission exactly as received.',
    },
    {
      label: 'Normalised dataset SHA-256',
      value: currentRun.normalized_dataset_hash,
      note: 'Digest after schema normalisation and field ordering.',
    },
    {
      label: 'Ruleset / configuration SHA-256',
      value: currentRun.configuration_hash,
      note: 'Digest of the rule set, weights and thresholds applied.',
    },
  ];

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Air-gap and audit"
        title="Run reproducibility manifest and audit trail"
        description="Each analysis run is hashed so that an identical dataset evaluated under an identical rule set always reproduces the same findings. Any divergence is a reportable integrity event."
        actions={
          canExport ? (
            <button className="btn btn-primary" onClick={exportAuditManifest}>
              <Download size={13} /> Export run manifest
            </button>
          ) : (
            <button className="btn btn-outline" disabled title="Forensic export requires examiner or administrator clearance">
              <Lock size={13} /> Export restricted
            </button>
          )
        }
      />

      <div className="stat-grid stagger">
        <Stat label="Analysis run" value={<span className="mono" style={{ fontSize: 15 }}>{currentRun.run_id}</span>} hint={currentRun.ruleset_version} />
        <Stat label="Findings" value={currentRun.record_counts.findings} hint={`${currentRun.record_counts.review_items} queue items produced.`} />
        <Stat label="Records examined" value={
          currentRun.record_counts.entities + currentRun.record_counts.assets +
          currentRun.record_counts.alerts + currentRun.record_counts.cases +
          currentRun.record_counts.escalations
        } hint="Across entities, assets, alerts, cases and escalations." />
        <Stat label="Audit events" value={auditTrail.length} hint="Every privileged action is appended." />
      </div>

      <Panel title="Cryptographic checksums" note="Copy any digest to compare against an independent recomputation.">
        <div className="grid-thirds">
          {hashes.map((h) => (
            <div className="inset" key={h.label} style={{ padding: 12 }}>
              <div className="row-between" style={{ marginBottom: 8 }}>
                <span className="text-xs" style={{ color: 'var(--fg)', fontWeight: 600 }}>{h.label}</span>
                <Hash size={13} color="var(--fg-3)" />
              </div>
              <div className="mono text-xs" style={{ wordBreak: 'break-all', color: 'var(--fg-2)', lineHeight: 1.6 }}>
                {h.value}
              </div>
              <div className="text-xs dim" style={{ marginTop: 8 }}>{h.note}</div>
              <div style={{ marginTop: 10 }}>
                <CopyButton value={h.value} label="Copy digest" />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Run metadata">
        <dl className="kv-grid">
          {[
            ['Run ID', currentRun.run_id],
            ['Ruleset version', currentRun.ruleset_version],
            ['Model version', currentRun.model_version],
            ['Application version', currentRun.application_version],
            ['Executed at', formatTimestamp(currentRun.created_at)],
            ['Initiated by', currentRun.created_by],
            ['Role', userRole],
            ['Warnings', currentRun.warnings.length ? currentRun.warnings.join('; ') : 'none'],
          ].map(([label, value]) => (
            <div className="kv" key={label}>
              <dt>{label}</dt>
              <dd className={label === 'Warnings' ? '' : 'mono'} style={{ fontSize: label === 'Warnings' ? 12 : undefined }}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel
        title="Examiner activity trail"
        note="Append-only. Entries are written by the application and cannot be edited from the interface."
        bodyClassName=""
      >
        {auditTrail.length === 0 ? (
          <EmptyState>No activity has been recorded in this session.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 170 }}>Timestamp</th>
                  <th style={{ width: 210 }}>Action</th>
                  <th style={{ width: 200 }}>Actor</th>
                  <th style={{ width: 150 }}>Target</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {auditTrail.map((entry) => (
                  <tr key={entry.id}>
                    <td className="mono nowrap">{formatTimestamp(entry.timestamp)}</td>
                    <td className="cell-strong mono" style={{ fontSize: 11.5 }}>{entry.action}</td>
                    <td>
                      <div>{entry.actor}</div>
                      <div className="cell-sub">{entry.role}</div>
                    </td>
                    <td>
                      <span className="chip">{entry.target_id}</span>
                    </td>
                    <td>{entry.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Enclave configuration" bodyClassName="panel-body">
        <div className="grid-quarters">
          {[
            ['Execution environment', 'Local host, no network'],
            ['Telemetry egress', 'Blocked by design'],
            ['Credential storage', 'Hashed, never plaintext'],
            ['Audit retention', 'Session scope'],
          ].map(([k, v]) => (
            <div className="inset" key={k} style={{ padding: 12 }}>
              <div className="text-xs dim">{k}</div>
              <div className="text-sm" style={{ color: 'var(--fg)', marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};
