import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { AlertRecord, CaseRecord, EscalationRecord, AssetRecord, EntityRecord } from '../types';
import { PageHeader, Panel, Badge, EmptyState, severityTone } from './ui';

interface EvidenceGraphTabProps {
  entities: EntityRecord[];
  assets: AssetRecord[];
  alerts: AlertRecord[];
  cases: CaseRecord[];
  escalations: EscalationRecord[];
  initialAlertId?: string;
}

const SEVERITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export const EvidenceGraphTab: React.FC<EvidenceGraphTabProps> = ({
  entities,
  assets,
  alerts,
  cases,
  escalations,
  initialAlertId,
}) => {
  const [selectedAlertId, setSelectedAlertId] = useState<string>(
    initialAlertId || alerts.find((a) => a.entity_id === 'CSE-B')?.alert_id || alerts[0]?.alert_id || '',
  );

  useEffect(() => {
    if (initialAlertId) setSelectedAlertId(initialAlertId);
  }, [initialAlertId]);

  const currentAlert = alerts.find((a) => a.alert_id === selectedAlertId) || alerts[0];
  const currentEntity = entities.find((e) => e.entity_id === currentAlert?.entity_id);
  const currentAsset = assets.find((a) => a.asset_id === currentAlert?.asset_id);
  const currentCase = cases.find(
    (c) => c.alert_id === currentAlert?.alert_id || c.case_id === currentAlert?.case_id,
  );
  const currentEscalations = currentCase ? escalations.filter((e) => e.case_id === currentCase.case_id) : [];

  const closureDurationSeconds =
    currentAlert?.created_at && currentAlert?.closed_at
      ? Math.round(
          (new Date(currentAlert.closed_at).getTime() - new Date(currentAlert.created_at).getTime()) / 1000,
        )
      : null;

  const isFastClosure =
    closureDurationSeconds !== null &&
    closureDurationSeconds <= 120 &&
    (currentAlert?.severity === 'Critical' || currentAlert?.severity === 'High');
  const isMissingCase = !currentCase && currentAlert?.severity === 'Critical';
  const isMissingEscalation =
    currentAlert?.severity === 'Critical' && Boolean(currentCase) && currentEscalations.length === 0;
  const isShortNote = Boolean(currentCase?.investigation_notes) && (currentCase?.investigation_notes.length ?? 0) < 20;

  // Group every alert by entity so any incident in the submission can be inspected.
  const groupedAlerts = useMemo(() => {
    const groups = new Map<string, AlertRecord[]>();
    alerts.forEach((a) => {
      const list = groups.get(a.entity_id) ?? [];
      list.push(a);
      groups.set(a.entity_id, list);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([entityId, list]) => ({
        entityId,
        alerts: list.sort(
          (a, b) =>
            (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) ||
            a.alert_id.localeCompare(b.alert_id),
        ),
      }));
  }, [alerts]);

  const selectedInGroups = groupedAlerts.some((g) => g.alerts.some((a) => a.alert_id === selectedAlertId));

  const chainIntegrity = [
    isMissingCase ? 'case missing' : 'case present',
    isMissingEscalation ? 'escalation missing' : 'escalation present',
    isFastClosure ? 'rapid closure' : 'closure normal',
  ].join(' · ');

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Section 14 — record lineage"
        title="End-to-end operational lifecycle"
        description={
          <>
            Traces <span className="mono text-xs">entity → asset → alert → case → investigation → escalation → closure</span> and
            flags broken policy links and implausible closures.
          </>
        }
        actions={
          <label className="row" style={{ gap: 8 }}>
            <span className="text-xs dim nowrap">Incident</span>
            <select
              className="select mono"
              style={{ minWidth: 320 }}
              value={selectedInGroups ? selectedAlertId : '__orphan'}
              onChange={(e) => setSelectedAlertId(e.target.value)}
              aria-label="Select incident"
            >
              {!selectedInGroups && selectedAlertId && (
                <option value="__orphan">
                  {selectedAlertId} ({currentAlert?.entity_id} · {currentAlert?.severity})
                </option>
              )}
              {groupedAlerts.map((group) => (
                <optgroup
                  key={group.entityId}
                  label={entities.find((e) => e.entity_id === group.entityId)?.entity_name || group.entityId}
                >
                  {group.alerts.map((a) => (
                    <option key={a.alert_id} value={a.alert_id}>
                      {a.alert_id} · {a.severity} · {a.alert_category}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        }
      />

      {!currentAlert ? (
        <Panel>
          <EmptyState>No alerts are present in the active dataset.</EmptyState>
        </Panel>
      ) : (
        <div className="grid-main">
          <Panel
            title="Lifecycle chain"
            note={`Alert ${currentAlert.alert_id} · ${chainIntegrity}`}
          >
            <div className="timeline">
              <div className="timeline-node">
                <span className="timeline-dot">1</span>
                <div className="node">
                  <div className="node-head">
                    <span className="node-title">Critical sector entity</span>
                    <span className="mono text-xs dim">{currentEntity?.entity_id}</span>
                  </div>
                  <div className="text-sm">{currentEntity?.entity_name}</div>
                  <div className="text-xs dim">Sector: {currentEntity?.sector}</div>
                </div>
              </div>

              <div className="timeline-node">
                <span className="timeline-dot">2</span>
                <div className="node">
                  <div className="node-head">
                    <span className="node-title">Asset inventory record</span>
                    <Badge tone={currentAsset?.criticality === 'Critical' ? 'critical' : 'neutral'}>
                      {currentAsset?.criticality ?? 'unknown'}
                    </Badge>
                  </div>
                  <div className="text-sm">{currentAsset?.asset_type || 'Asset not present in inventory'}</div>
                  <div className="mono text-xs dim">{currentAsset?.asset_id}</div>
                </div>
              </div>

              <div className="timeline-node">
                <span className="timeline-dot">3</span>
                <div className="node">
                  <div className="node-head">
                    <span className="node-title">Telemetry ingestion and alert</span>
                    <Badge tone={severityTone(currentAlert.severity)}>{currentAlert.severity}</Badge>
                  </div>
                  <div className="text-sm">{currentAlert.alert_category}</div>
                  <div className="text-xs dim mono">
                    created {currentAlert.created_at} · source {currentAlert.source_control} · row{' '}
                    {currentAlert.source_row_number}
                  </div>
                </div>
              </div>

              <div className="timeline-node">
                <span className="timeline-dot" data-state={isMissingCase ? 'bad' : undefined}>4</span>
                <div className="node" data-state={isMissingCase ? 'bad' : undefined}>
                  <div className="node-head">
                    <span className="node-title">Case investigation record</span>
                    {isMissingCase ? (
                      <span className="row text-xs" style={{ color: 'var(--danger)', gap: 5 }}>
                        <XCircle size={13} /> Case missing
                      </span>
                    ) : (
                      <span className="mono text-xs dim">{currentCase?.case_id}</span>
                    )}
                  </div>

                  {currentCase ? (
                    <>
                      <div className="text-sm muted">
                        <span style={{ color: 'var(--fg)' }}>Investigator note: </span>
                        <em>“{currentCase.investigation_notes}”</em>
                      </div>
                      {isShortNote && (
                        <div className="row text-xs" style={{ color: 'var(--warn)', gap: 5, marginTop: 5 }}>
                          <AlertTriangle size={12} /> Note under 20 characters — possible boilerplate
                        </div>
                      )}
                      <div className="text-xs dim" style={{ marginTop: 5 }}>
                        Impact {currentCase.impact} · closure reason {currentCase.closure_reason}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm" style={{ color: 'var(--danger)' }}>
                      This alert was closed without a case record, which the framework requires for
                      critical severity.
                    </div>
                  )}
                </div>
              </div>

              <div className="timeline-node">
                <span className="timeline-dot" data-state={isMissingEscalation ? 'bad' : currentEscalations.length ? 'ok' : undefined}>
                  5
                </span>
                <div className="node" data-state={isMissingEscalation ? 'bad' : undefined}>
                  <div className="node-head">
                    <span className="node-title">Escalation record</span>
                    {isMissingEscalation ? (
                      <span className="row text-xs" style={{ color: 'var(--danger)', gap: 5 }}>
                        <XCircle size={13} /> Broken link — policy bypass
                      </span>
                    ) : currentEscalations.length > 0 ? (
                      <span className="row text-xs" style={{ color: 'var(--ok)', gap: 5 }}>
                        <CheckCircle2 size={13} /> Escalation confirmed
                      </span>
                    ) : (
                      <span className="text-xs dim">Not required for this severity</span>
                    )}
                  </div>

                  {isMissingEscalation ? (
                    <div className="text-sm" style={{ color: 'var(--fg-2)' }}>
                      A high-impact case was closed internally without notifying the mandated sectoral
                      coordination centre or CISO.
                    </div>
                  ) : currentEscalations.length === 0 ? (
                    <div className="text-xs dim">No escalation record is attached to this case.</div>
                  ) : (
                    <div className="stack-8">
                      {currentEscalations.map((e) => (
                        <div className="text-xs" key={e.escalation_id} style={{ color: 'var(--fg-2)' }}>
                          <span style={{ color: 'var(--fg)' }}>{e.escalation_type}</span> →{' '}
                          <span className="mono">{e.recipient_role}</span> · {e.outcome} ·{' '}
                          <span className="mono dim">{e.escalated_at}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="timeline-node">
                <span className="timeline-dot" data-state={isFastClosure ? 'warn' : 'ok'}>6</span>
                <div className="node" data-state={isFastClosure ? 'warn' : undefined}>
                  <div className="node-head">
                    <span className="node-title">Closure</span>
                    {isFastClosure ? (
                      <span className="row text-xs" style={{ color: 'var(--warn)', gap: 5 }}>
                        <Clock size={13} /> Suspicious rapid closure
                      </span>
                    ) : (
                      <span className="row text-xs" style={{ color: 'var(--ok)', gap: 5 }}>
                        <CheckCircle2 size={13} /> Within normal envelope
                      </span>
                    )}
                  </div>
                  <div className="text-sm mono">{currentAlert.closed_at || 'not closed'}</div>
                  {closureDurationSeconds !== null && (
                    <div className="text-xs dim" style={{ marginTop: 4 }}>
                      Elapsed {closureDurationSeconds}s
                      {isFastClosure && ' against a peer baseline measured in tens of minutes'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Panel>

          <div className="stack">
            <Panel title="Normalised alert record" note="Exactly as ingested, after schema normalisation.">
              <pre className="codeblock">
                {[
                  ['alert_id', currentAlert.alert_id, 's'],
                  ['entity_id', currentAlert.entity_id, 's'],
                  ['asset_id', currentAlert.asset_id, 's'],
                  ['alert_category', currentAlert.alert_category, 's'],
                  ['source_control', currentAlert.source_control, 's'],
                  ['severity', currentAlert.severity, 's'],
                  ['created_at', currentAlert.created_at, 's'],
                  ['acknowledged_at', currentAlert.acknowledged_at ?? 'null', 's'],
                  ['closed_at', currentAlert.closed_at ?? 'null', 's'],
                  ['disposition', currentAlert.disposition, 's'],
                  ['case_id', currentAlert.case_id ?? 'null', 's'],
                ]
                  .map(([k, v, ]) => `${k}:`.padEnd(18) + (v === 'null' ? 'null' : `"${v}"`))
                  .join('\n')}
                {'\nsource_row:'.padEnd(18) + currentAlert.source_row_number}
              </pre>
            </Panel>

            <Panel
              title="Linked case record"
              note={currentCase ? `Case ${currentCase.case_id}` : 'No case is linked to this alert.'}
            >
              {currentCase ? (
                <pre className="codeblock">
                  {[
                    `case_id:`.padEnd(26) + `"${currentCase.case_id}"`,
                    `investigator_id_hash:`.padEnd(26) + `"${currentCase.investigator_id_hash}"`,
                    `started_at:`.padEnd(26) + `"${currentCase.investigation_started_at}"`,
                    `completed_at:`.padEnd(26) + `"${currentCase.investigation_completed_at ?? 'null'}"`,
                    `impact:`.padEnd(26) + `"${currentCase.impact}"`,
                    `closure_reason:`.padEnd(26) + `"${currentCase.closure_reason}"`,
                    `notes:`.padEnd(26) + `"${currentCase.investigation_notes}"`,
                    `source_row:`.padEnd(26) + currentCase.source_row_number,
                  ].join('\n')}
                </pre>
              ) : (
                <EmptyState>No case record exists for this alert.</EmptyState>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
};
