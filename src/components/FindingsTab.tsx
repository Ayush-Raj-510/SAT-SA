import React, { useState, useMemo } from 'react';
import { ChevronRight, Download, AlertTriangle } from 'lucide-react';
import { FindingRecord, FindingClass } from '../types';
import { PageHeader, Panel, Badge, Stat, FilterSelect, SearchInput, EmptyState, severityTone } from './ui';
import { formatTimestamp } from '../engine/format';

interface FindingsTabProps {
  findings: FindingRecord[];
  onSelectEntity?: (entityId: string) => void;
  onExport?: () => void;
  runId?: string;
  datasetHash?: string;
}

const CLASS_LABEL: Record<FindingClass, string> = {
  execution_gap: 'Execution gap',
  negative_space: 'Negative space',
  data_quality: 'Data quality',
  anomaly_discovery: 'Anomaly discovery',
};

const CLASS_TONE: Record<FindingClass, 'critical' | 'accent' | 'high' | 'medium'> = {
  execution_gap: 'critical',
  negative_space: 'accent',
  data_quality: 'high',
  anomaly_discovery: 'medium',
};

export const FindingsTab: React.FC<FindingsTabProps> = ({ findings, onSelectEntity, onExport }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(findings[0]?.finding_id ?? null);

  const filteredFindings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return findings.filter((f) => {
      const matchesSearch =
        !term ||
        f.finding_type.toLowerCase().includes(term) ||
        f.rationale.toLowerCase().includes(term) ||
        f.entity_id.toLowerCase().includes(term) ||
        f.rule_id.toLowerCase().includes(term);
      const matchesClass = selectedClass === 'ALL' || f.finding_class === selectedClass;
      const matchesSeverity = selectedSeverity === 'ALL' || f.severity === selectedSeverity;
      return matchesSearch && matchesClass && matchesSeverity;
    });
  }, [findings, searchTerm, selectedClass, selectedSeverity]);

  const criticalCount = findings.filter((f) => f.severity === 'Critical').length;
  const entitiesAffected = new Set(findings.map((f) => f.entity_id)).size;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Sections 9 and 13 — evidence-first findings"
        title="Deterministic and statistical findings"
        description="Every finding carries its rule identifier, the statistical threshold that fired, an explicit uncertainty note, and a recommended supervisory action."
        actions={
          <button className="btn btn-outline" onClick={onExport}>
            <Download size={13} /> Export findings CSV
          </button>
        }
      />

      <div className="stat-grid stagger">
        <Stat label="Findings raised" value={findings.length} hint="In the active run." />
        <Stat label="Critical severity" value={criticalCount} tone="critical" hint="Require immediate supervisory attention." />
        <Stat label="Entities implicated" value={entitiesAffected} hint="Distinct entities named by at least one finding." />
        <Stat
          label="Detector rules"
          value={new Set(findings.map((f) => f.rule_id)).size}
          hint="Distinct rules that produced at least one finding."
        />
      </div>

      <Panel bodyClassName="panel-body panel-body-tight">
        <div className="row-between">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search finding, rationale, rule ID, or entity"
            aria-label="Search findings"
          />
          <div className="row" style={{ gap: 12 }}>
            <FilterSelect
              label="Class"
              value={selectedClass}
              onChange={setSelectedClass}
              options={[
                { value: 'ALL', label: 'All classes' },
                ...(Object.keys(CLASS_LABEL) as FindingClass[]).map((c) => ({ value: c, label: CLASS_LABEL[c] })),
              ]}
            />
            <FilterSelect
              label="Severity"
              value={selectedSeverity}
              onChange={setSelectedSeverity}
              options={[
                { value: 'ALL', label: 'All severities' },
                { value: 'Critical', label: 'Critical' },
                { value: 'High', label: 'High' },
                { value: 'Medium', label: 'Medium' },
                { value: 'Low', label: 'Low' },
              ]}
            />
            <span className="text-xs dim nowrap">
              {filteredFindings.length} of {findings.length}
            </span>
          </div>
        </div>
      </Panel>

      {filteredFindings.length === 0 ? (
        <Panel>
          <EmptyState>No findings match the current filters.</EmptyState>
        </Panel>
      ) : (
        <div className="stack-8">
          {filteredFindings.map((finding) => {
            const isOpen = expandedId === finding.finding_id;
            const evidence = finding.evidence_record_ids_json || {};
            const evidenceIds = [
              ...(evidence.alert_ids ?? []),
              ...(evidence.case_ids ?? []),
              ...(evidence.asset_ids ?? []),
              ...(evidence.escalation_ids ?? []),
            ];

            return (
              <Panel key={finding.finding_id} bodyClassName="">
                {/* A div rather than a button: the row also hosts a nested
                    control for drilling into the entity, and interactive
                    content cannot legally nest inside a <button>. */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(isOpen ? null : finding.finding_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandedId(isOpen ? null : finding.finding_id);
                    }
                  }}
                  aria-expanded={isOpen}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 16px',
                    background: 'none',
                    border: 0,
                    textAlign: 'left',
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  <span
                    style={{
                      width: 3,
                      alignSelf: 'stretch',
                      borderRadius: 2,
                      background:
                        finding.severity === 'Critical' ? 'var(--danger)'
                        : finding.severity === 'High' ? 'var(--warn)'
                        : 'var(--accent)',
                      flexShrink: 0,
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="mono text-xs dim">{finding.finding_id}</span>
                      <span className="title-sm">{finding.finding_type}</span>
                    </div>
                    <div className="row text-xs dim" style={{ gap: 8, marginTop: 3 }}>
                      <button
                        className="btn-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEntity?.(finding.entity_id);
                        }}
                        style={{ color: 'var(--fg-2)' }}
                      >
                        {finding.entity_id}
                      </button>
                      <span>·</span>
                      <span className="mono">{finding.rule_id}</span>
                      <span>·</span>
                      <span>{finding.period}</span>
                      <span>·</span>
                      <span>score {finding.score}</span>
                    </div>
                  </div>

                  <Badge tone={CLASS_TONE[finding.finding_class]}>{CLASS_LABEL[finding.finding_class]}</Badge>
                  <Badge tone={severityTone(finding.severity)}>{finding.severity}</Badge>
                  <ChevronRight
                    size={15}
                    color="var(--fg-3)"
                    style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
                  />
                </div>

                {isOpen && (
                  <div
                    style={{
                      borderTop: '1px solid var(--line)',
                      padding: 16,
                      background: 'var(--surface-inset)',
                    }}
                  >
                    <div className="grid-half">
                      <div>
                        <div className="section-title">Observed evidence</div>
                        <p className="text-sm muted" style={{ margin: 0 }}>{finding.rationale}</p>
                      </div>

                      <div>
                        <div className="section-title">Uncertainty and alternatives</div>
                        <div className="callout callout-warn">
                          <AlertTriangle size={15} />
                          <div>{finding.uncertainty_note}</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid-half" style={{ marginTop: 16 }}>
                      <div>
                        <div className="section-title">Threshold and comparison logic</div>
                        <pre className="codeblock">{JSON.stringify(finding.threshold_json, null, 2)}</pre>
                      </div>

                      <div>
                        <div className="section-title">Recommended supervisory action</div>
                        <p className="text-sm" style={{ margin: '0 0 12px', color: 'var(--fg)' }}>
                          {finding.recommended_action}
                        </p>

                        <div className="text-xs dim" style={{ marginBottom: 6 }}>
                          Traceable evidence records ({evidenceIds.length})
                        </div>
                        {evidenceIds.length === 0 ? (
                          <span className="text-xs dim">No row-level identifiers attached to this finding.</span>
                        ) : (
                          <div className="row" style={{ gap: 5 }}>
                            {evidenceIds.slice(0, 14).map((id) => (
                              <span className="chip" key={id}>{id}</span>
                            ))}
                            {evidenceIds.length > 14 && (
                              <span className="text-xs dim">+{evidenceIds.length - 14} more</span>
                            )}
                          </div>
                        )}

                        <dl className="dl" style={{ marginTop: 14 }}>
                          <div className="dl-row">
                            <dt>Rule version</dt>
                            <dd className="mono">{finding.rule_version}</dd>
                          </div>
                          <div className="dl-row">
                            <dt>Status</dt>
                            <dd>{finding.status}</dd>
                          </div>
                          <div className="dl-row">
                            <dt>Created</dt>
                            <dd className="mono">{formatTimestamp(finding.created_at)}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
};
