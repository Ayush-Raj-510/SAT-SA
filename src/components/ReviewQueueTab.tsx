import React, { useState, useMemo } from 'react';
import { Download, MessageSquare, AlertCircle, FileSearch } from 'lucide-react';
import { ReviewQueueItem, ReviewStatus, UserRole, UserProfile } from '../types';
import {
  PageHeader,
  Panel,
  Badge,
  Stat,
  Modal,
  FilterSelect,
  SearchInput,
  EmptyState,
  bandTone,
  statusTone,
} from './ui';

interface ReviewQueueTabProps {
  queueItems: ReviewQueueItem[];
  userRole: UserRole;
  currentUser?: UserProfile;
  onUpdateStatus: (itemId: string, status: ReviewStatus, comment: string) => void;
  onViewEvidenceGraph?: (alertId?: string) => void;
  onExport?: () => void;
}

const STATUSES: ReviewStatus[] = [
  'Pending',
  'Under Review',
  'Verified Issue',
  'False Positive',
  'Exception Noted',
];

const STATUS_LABEL: Record<ReviewStatus, string> = {
  Pending: 'Pending review',
  'Under Review': 'Under review (assigned)',
  'Verified Issue': 'Verified issue',
  'False Positive': 'False positive',
  'Exception Noted': 'Exception noted',
};

export const ReviewQueueTab: React.FC<ReviewQueueTabProps> = ({
  queueItems,
  userRole,
  currentUser,
  onUpdateStatus,
  onViewEvidenceGraph,
  onExport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedBand, setSelectedBand] = useState('ALL');
  const [activeItem, setActiveItem] = useState<ReviewQueueItem | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [statusInput, setStatusInput] = useState<ReviewStatus>('Pending');

  const readOnly = userRole === 'Read-only Reviewer';

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return queueItems.filter((item) => {
      const matchesSearch =
        !term ||
        (item.alert_id ?? '').toLowerCase().includes(term) ||
        (item.case_id ?? '').toLowerCase().includes(term) ||
        item.entity_name.toLowerCase().includes(term) ||
        item.evidence_summary.toLowerCase().includes(term);
      const matchesStatus = selectedStatus === 'ALL' || item.review_status === selectedStatus;
      const matchesBand = selectedBand === 'ALL' || item.priority_band === selectedBand;
      return matchesSearch && matchesStatus && matchesBand;
    });
  }, [queueItems, searchTerm, selectedStatus, selectedBand]);

  const counts = useMemo(
    () => ({
      total: queueItems.length,
      pending: queueItems.filter((q) => q.review_status === 'Pending').length,
      verified: queueItems.filter((q) => q.review_status === 'Verified Issue').length,
      cleared: queueItems.filter((q) => q.review_status === 'False Positive').length,
    }),
    [queueItems],
  );

  const open = (item: ReviewQueueItem) => {
    setActiveItem(item);
    setCommentInput(item.examiner_comment || '');
    setStatusInput(item.review_status);
  };

  const save = () => {
    if (!activeItem) return;
    onUpdateStatus(activeItem.queue_item_id, statusInput, commentInput);
    setActiveItem(null);
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Section 12 — prioritised operational queue"
        title="Examiner triage and verification queue"
        description={
          <>
            Periodic submissions are reduced to a defensible priority queue weighted by{' '}
            <span className="mono text-xs">0.30 severity + 0.25 execution evidence + 0.20 asset criticality + 0.15 peer deviation + 0.10 chain integrity</span>.
            Every item resolves back to source rows.
          </>
        }
        actions={
          <button className="btn btn-outline" onClick={onExport}>
            <Download size={13} /> Export queue CSV
          </button>
        }
      />

      <div className="stat-grid stagger">
        <Stat label="Prioritised items" value={counts.total} hint="Across all entities in the active run." />
        <Stat label="Awaiting review" value={counts.pending} tone="high" hint="No examiner determination recorded." />
        <Stat label="Verified issues" value={counts.verified} tone="critical" hint="Confirmed as genuine deficiencies." />
        <Stat label="Cleared" value={counts.cleared} tone="low" hint="Assessed as false positives." />
      </div>

      <Panel bodyClassName="panel-body panel-body-tight">
        <div className="row-between">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search alert ID, case ID, entity, or evidence"
            aria-label="Search review queue"
          />
          <div className="row" style={{ gap: 12 }}>
            <FilterSelect
              label="Status"
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={[{ value: 'ALL', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: s }))]}
            />
            <FilterSelect
              label="Band"
              value={selectedBand}
              onChange={setSelectedBand}
              options={[
                { value: 'ALL', label: 'All bands' },
                { value: 'Critical', label: 'Critical' },
                { value: 'High', label: 'High' },
                { value: 'Medium', label: 'Medium' },
                { value: 'Low', label: 'Low' },
              ]}
            />
            <span className="text-xs dim nowrap">
              {filteredItems.length} of {queueItems.length}
            </span>
          </div>
        </div>
      </Panel>

      <Panel bodyClassName="">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th className="cell-center" style={{ width: 60 }}>Score</th>
                <th style={{ width: 150 }}>Alert / case</th>
                <th style={{ width: 210 }}>Entity and asset</th>
                <th>Evidence summary</th>
                <th style={{ width: 150 }}>Status</th>
                <th style={{ width: 100 }} />
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState>No queue items match the current filters.</EmptyState>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.queue_item_id} className="is-clickable" onClick={() => open(item)}>
                    <td className="cell-center">
                      <Badge tone={bandTone(item.priority_band)} mono>{item.priority_score}</Badge>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="row-link mono"
                        title={`Open queue item ${item.queue_item_id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          open(item);
                        }}
                      >
                        {item.alert_id || item.case_id || item.queue_item_id}
                      </button>
                      {item.case_id && item.alert_id && (
                        <div className="cell-sub mono">case {item.case_id}</div>
                      )}
                    </td>
                    <td>
                      <div className="cell-strong" style={{ fontWeight: 400 }}>{item.entity_name}</div>
                      <div className="cell-sub mono">{item.asset_id || 'systemic'}</div>
                    </td>
                    <td>
                      <div className="clamp-2" style={{ maxWidth: 460 }}>{item.evidence_summary}</div>
                      {item.examiner_comment && (
                        <div className="cell-sub" style={{ color: 'var(--warn)', display: 'flex', gap: 5, alignItems: 'center', marginTop: 3 }}>
                          <MessageSquare size={11} /> {item.examiner_comment}
                        </div>
                      )}
                    </td>
                    <td>
                      <Badge tone={statusTone(item.review_status)}>{item.review_status}</Badge>
                    </td>
                    <td className="cell-num">
                      <span className="btn btn-sm btn-outline">Examine</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {activeItem && (
        <Modal
          title={activeItem.alert_id || activeItem.case_id || activeItem.queue_item_id}
          subtitle={
            <>
              {activeItem.entity_name} ({activeItem.entity_id}) · asset {activeItem.asset_id || 'global'} ·
              queue item <span className="mono">{activeItem.queue_item_id}</span>
            </>
          }
          onClose={() => setActiveItem(null)}
          width={760}
          actions={
            <>
              <Badge tone={bandTone(activeItem.priority_band)}>Priority {activeItem.priority_score}</Badge>
              <Badge tone="neutral">Severity {activeItem.severity}</Badge>
            </>
          }
          footer={<span>Determinations are recorded in the immutable audit trail with the examiner badge ID.</span>}
        >
          <div className="stack">
            <Panel title="Observed operational evidence">
              <p className="text-sm muted" style={{ margin: 0 }}>{activeItem.evidence_summary}</p>

              {activeItem.details?.closure_duration_seconds !== undefined && (
                <div className="row" style={{ gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <div>
                    <div className="text-xs dim">Closure duration</div>
                    <div className="mono fg">{activeItem.details.closure_duration_seconds}s</div>
                  </div>
                  {activeItem.details.peer_deviation && (
                    <div>
                      <div className="text-xs dim">Peer comparison</div>
                      <div className="mono fg">{activeItem.details.peer_deviation}</div>
                    </div>
                  )}
                  {activeItem.details.is_escalated !== undefined && (
                    <div>
                      <div className="text-xs dim">Escalated</div>
                      <div className="mono fg">{activeItem.details.is_escalated ? 'Yes' : 'No'}</div>
                    </div>
                  )}
                </div>
              )}

              {activeItem.details?.investigation_notes && (
                <div style={{ marginTop: 12 }}>
                  <div className="text-xs dim" style={{ marginBottom: 5 }}>Submitted investigation note</div>
                  <blockquote
                    className="inset"
                    style={{ margin: 0, padding: '10px 12px', fontStyle: 'italic', color: 'var(--fg-2)' }}
                  >
                    “{activeItem.details.investigation_notes}”
                  </blockquote>
                </div>
              )}
            </Panel>

            {onViewEvidenceGraph && (
              <button
                className="btn btn-outline"
                onClick={() => {
                  onViewEvidenceGraph(activeItem.alert_id);
                  setActiveItem(null);
                }}
              >
                <FileSearch size={13} /> Inspect full lifecycle in the evidence chain
              </button>
            )}

            <Panel title="Examiner determination" note="A human decision is required; the engine never closes a finding on its own.">
              {readOnly ? (
                <div className="callout callout-danger">
                  <AlertCircle size={15} />
                  <div>
                    <strong>Read-only clearance.</strong> Signed in as{' '}
                    {currentUser?.name || 'compliance auditor'} ({currentUser?.badge_id || 'CERT-AUD-920'}).
                    Recording a determination requires examiner or administrator clearance.
                  </div>
                </div>
              ) : (
                <div className="stack-12">
                  <div className="grid-half">
                    <div className="field">
                      <label className="label" htmlFor="determination-status">Determination</label>
                      <select
                        id="determination-status"
                        className="select"
                        value={statusInput}
                        onChange={(e) => setStatusInput(e.target.value as ReviewStatus)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="examiner-id">Examiner of record</label>
                      <input
                        id="examiner-id"
                        className="input mono"
                        readOnly
                        value={currentUser ? `${currentUser.name} [${currentUser.badge_id}]` : `EXAMINER-${userRole.toUpperCase()}-01`}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label className="label" htmlFor="examiner-comment">Supervisory conclusion and audit comment</label>
                    <textarea
                      id="examiner-comment"
                      className="textarea"
                      rows={3}
                      placeholder="Record the basis for this determination — interview notes, sampled records, or the formal justification for an exception."
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                    />
                  </div>

                  <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn-outline" onClick={() => setActiveItem(null)}>Cancel</button>
                    <button className="btn btn-primary" onClick={save}>Save determination</button>
                  </div>
                </div>
              )}
            </Panel>
          </div>
        </Modal>
      )}
    </div>
  );
};
