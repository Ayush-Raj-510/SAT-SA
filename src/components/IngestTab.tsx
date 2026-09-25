import React, { useState } from 'react';
import {
  UploadCloud,
  AlertCircle,
  Download,
  RefreshCw,
  Copy,
  Check,
  Archive,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { formatShortHash } from '../engine/crypto';
import { formatBytes } from '../engine/format';
import { parseUploadedSOCData, IngestSummary, ParseResult } from '../engine/dataParser';
import {
  SAMPLE_ALERTS_CSV,
  SAMPLE_RANSOMWARE_CSV,
  SAMPLE_JSON_DATASET,
  createSampleZipBlob,
} from '../data/sampleDatasets';
import { SyntheticDataset } from '../data/syntheticGenerator';
import { UserRole, UserProfile } from '../types';
import { PageHeader, Panel, Badge, Stat, Callout, EmptyState } from './ui';

interface IngestTabProps {
  onIngestSuccess: (dataset: SyntheticDataset, summary: IngestSummary) => void;
  userRole?: UserRole;
  currentUser?: UserProfile;
  currentDataset: SyntheticDataset;
  onNavigateToOverview: () => void;
  onNavigateToLeaderboard: () => void;
  onNavigateToFindings: () => void;
  onNavigateToQueue: () => void;
  activeDatasetName?: string;
  isCustomDataset?: boolean;
  onResetBaseline?: () => void;
}

const SCHEMAS: { file: string; required: boolean; columns: string }[] = [
  { file: 'alerts.csv', required: true, columns: 'alert_id, entity_id, asset_id, alert_category, source_control, severity, created_at, closed_at, disposition' },
  { file: 'cases.csv', required: false, columns: 'case_id, entity_id, alert_id, investigator_id_hash, investigation_notes, impact, closure_reason' },
  { file: 'escalations.csv', required: false, columns: 'escalation_id, case_id, escalation_type, escalated_at, recipient_role, outcome' },
  { file: 'assets.csv', required: false, columns: 'asset_id, entity_id, asset_type, criticality, environment, expected_controls, active_from' },
  { file: 'entities.csv', required: false, columns: 'entity_id, name, sector, tier, contact_email, jurisdiction' },
];

export const IngestTab: React.FC<IngestTabProps> = ({
  onIngestSuccess,
  userRole = 'Examiner',
  currentUser,
  currentDataset,
  onNavigateToOverview,
  onNavigateToLeaderboard,
  onNavigateToFindings,
  onNavigateToQueue,
  activeDatasetName = 'Default 6-CSE ground-truth baseline',
  isCustomDataset = false,
  onResetBaseline,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [ingestMode, setIngestMode] = useState<'replace' | 'append'>('replace');
  const [activeInputMethod, setActiveInputMethod] = useState<'file' | 'paste' | 'preset'>('file');
  const [pastedContent, setPastedContent] = useState('');
  const [pastedFileName, setPastedFileName] = useState('pasted_soc_batch.csv');

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<IngestSummary | null>(null);
  const [normalizedPreview, setNormalizedPreview] = useState<SyntheticDataset | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  const isReadOnly = userRole === 'Read-only Reviewer';

  const executeIngest = async (fileName: string, rawContent: string | ArrayBuffer) => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const result: ParseResult = await parseUploadedSOCData(
        fileName,
        rawContent,
        currentDataset,
        ingestMode,
      );

      if (!result.success || !result.dataset || !result.summary) {
        setErrorMessage(result.error || 'Could not parse the file. Check the column headers against the schema below.');
        setIsProcessing(false);
        return;
      }

      setLastSummary(result.summary);
      setNormalizedPreview(result.dataset);
      onIngestSuccess(result.dataset, result.summary);
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred during ingestion.');
    } finally {
      setIsProcessing(false);
    }
  };

  const readFileThenIngest = (file: File) => {
    const isZip = file.name.toLowerCase().endsWith('.zip') || file.type.includes('zip');
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (content) executeIngest(file.name, content);
    };
    if (isZip) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) readFileThenIngest(e.dataTransfer.files[0]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) readFileThenIngest(e.target.files[0]);
    e.target.value = '';
  };

  const handlePasteSubmit = () => {
    if (!pastedContent.trim()) {
      setErrorMessage('Paste CSV or JSON text before processing.');
      return;
    }
    executeIngest(pastedFileName || 'pasted_soc_batch.csv', pastedContent);
  };

  const handleLoadSampleZip = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      const zipBlob = await createSampleZipBlob();
      await executeIngest('statutory_soc_submission_bundle.zip', await zipBlob.arrayBuffer());
    } catch (err: any) {
      setErrorMessage('Could not generate the sample archive: ' + err.message);
      setIsProcessing(false);
    }
  };

  const downloadBlob = (fileName: string, content: string | Blob, mime?: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSampleZip = async () => {
    try {
      downloadBlob('statutory_soc_submission_bundle.zip', await createSampleZipBlob());
    } catch (err: any) {
      setErrorMessage('Could not download the sample archive: ' + err.message);
    }
  };

  const handleDownloadCurrentNormalized = () => {
    if (!normalizedPreview) return;
    downloadBlob(
      `normalized_${lastSummary?.fileName || 'dataset'}.json`,
      JSON.stringify(normalizedPreview, null, 2),
      'application/json',
    );
  };

  const copyTemplateToClipboard = () => {
    navigator.clipboard?.writeText(SAMPLE_ALERTS_CSV).then(
      () => {
        setCopiedTemplate(true);
        window.setTimeout(() => setCopiedTemplate(false), 1800);
      },
      () => undefined,
    );
  };

  const presets = [
    {
      tag: 'Multi-table archive',
      tone: 'accent' as const,
      title: 'Statutory SOC submission bundle',
      meta: '5 linked CSVs inside one .zip',
      body: 'alerts.csv, cases.csv, assets.csv, entities.csv and escalations.csv extracted and normalised as a single batch.',
      primary: { label: 'Load sample archive', run: handleLoadSampleZip },
      secondary: { label: 'Download .zip', run: handleDownloadSampleZip },
    },
    {
      tag: 'CSV',
      tone: 'low' as const,
      title: 'Standard multi-entity alert batch',
      meta: '10 alerts across 5 entities',
      body: 'SWIFT attacks, BGP route shifts and SCADA grid fluctuations with complete triage and escalation records.',
      primary: {
        label: 'Load and analyse',
        run: () => executeIngest('standard_soc_alerts_batch.csv', SAMPLE_ALERTS_CSV),
      },
    },
    {
      tag: 'Attack scenario',
      tone: 'critical' as const,
      title: 'Ransomware with metric gaming',
      meta: '5 rapid closures',
      body: 'BlackCat and LockBit style alerts closed in under two minutes with identical triage text, to exercise the fast-closure detector.',
      primary: {
        label: 'Load and analyse',
        run: () => executeIngest('ransomware_gaming_scenario.csv', SAMPLE_RANSOMWARE_CSV),
      },
    },
    {
      tag: 'JSON',
      tone: 'high' as const,
      title: 'Complete enclave submission',
      meta: '4 linked tables',
      body: 'Full dataset with entity declarations, asset manifests, alerts, cases and formal CERT-In escalation records.',
      primary: {
        label: 'Load and analyse',
        run: () => executeIngest('sovereign_enclave_submission.json', JSON.stringify(SAMPLE_JSON_DATASET)),
      },
    },
  ];

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Section 8 — batch ingestion and schema normalisation"
        title="Periodic submission ingest"
        description="Upload raw SOC telemetry as CSV or JSON. The pipeline parses headers, enforces referential integrity, computes an audit hash, and recalculates every view from the new dataset."
        actions={
          <>
            <Badge tone={isCustomDataset ? 'high' : 'neutral'}>
              {isCustomDataset ? 'ingested submission active' : 'baseline dataset active'}
            </Badge>
            {isCustomDataset && onResetBaseline && (
              <button className="btn btn-outline" onClick={onResetBaseline}>
                <RefreshCw size={13} /> Revert to baseline
              </button>
            )}
          </>
        }
      />

      <div className="stat-grid stagger">
        <Stat label="Active dataset" value={<span style={{ fontSize: 14 }}>{activeDatasetName}</span>} hint={isCustomDataset ? 'Ingested submission' : 'Reference baseline'} />
        <Stat label="Ingest mode" value={ingestMode === 'replace' ? 'Replace' : 'Append'} hint={ingestMode === 'replace' ? 'Incoming batch becomes the whole dataset.' : 'Incoming records are merged into the active dataset.'} />
        <Stat label="Records currently loaded" value={currentDataset.alerts.length} unit="alerts" hint={`${currentDataset.entities.length} entities · ${currentDataset.cases.length} cases`} />
        <Stat label="Your privilege" value={<span style={{ fontSize: 14 }}>{userRole}</span>} hint={isReadOnly ? 'Ingestion is disabled for this role.' : 'Ingestion permitted.'} />
      </div>

      {isReadOnly && (
        <Callout tone="danger" icon={<ShieldAlert size={16} />} title="Ingestion restricted for read-only clearance">
          You are signed in as <strong>{currentUser?.name || 'compliance auditor'}</strong>{' '}
          ({currentUser?.badge_id || 'CERT-AUD-920'}). Uploading and normalising submissions requires examiner
          or administrator clearance. Switch account from the header to ingest data.
        </Callout>
      )}

      {errorMessage && (
        <Callout tone="danger" icon={<AlertCircle size={16} />} title="Ingestion failed">
          {errorMessage}
        </Callout>
      )}

      <Panel bodyClassName="panel-body panel-body-tight">
        <div className="row-between">
          <div className="seg" role="tablist" aria-label="Input method">
            {(
              [
                ['file', 'Upload file'],
                ['paste', 'Paste CSV or JSON'],
                ['preset', 'Sample presets'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeInputMethod === id}
                data-active={activeInputMethod === id}
                className="seg-item"
                onClick={() => setActiveInputMethod(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="row" style={{ gap: 8 }}>
            <span className="text-xs dim nowrap">Dataset mode</span>
            <div className="seg" role="radiogroup" aria-label="Dataset mode">
              {(
                [
                  ['replace', 'Replace'],
                  ['append', 'Append'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={ingestMode === id}
                  data-active={ingestMode === id}
                  className="seg-item"
                  onClick={() => setIngestMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      {activeInputMethod === 'file' && (
        <div
          className="dropzone"
          data-active={dragActive}
          data-disabled={isReadOnly}
          onDragEnter={!isReadOnly ? handleDrag : undefined}
          onDragLeave={!isReadOnly ? handleDrag : undefined}
          onDragOver={!isReadOnly ? handleDrag : undefined}
          onDrop={!isReadOnly ? handleDrop : undefined}
        >
          <UploadCloud className="dz-icon" />
          <div className="title-sm" style={{ fontSize: 14 }}>
            Drop a submission batch here, or browse for one
          </div>
          <p className="text-xs dim" style={{ maxWidth: '58ch', margin: '6px auto 0' }}>
            Accepts multi-table <span className="mono">.zip</span> archives plus standalone{' '}
            <span className="mono">.csv</span> and <span className="mono">.json</span> files. Nothing is uploaded
            anywhere — parsing happens in this browser tab.
          </p>

          <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 18 }}>
            {isReadOnly ? (
              <button className="btn" disabled>Upload restricted for this role</button>
            ) : (
              <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                <Archive size={14} />
                {isProcessing ? 'Processing batch…' : 'Browse local file'}
                <input
                  type="file"
                  name="submission-batch"
                  accept=".zip,.csv,.json,.txt"
                  onChange={handleFileInput}
                  disabled={isProcessing}
                  style={{ display: 'none' }}
                />
              </label>
            )}
            {isProcessing && <span className="text-xs dim">Parsing and normalising…</span>}
          </div>
        </div>
      )}

      {activeInputMethod === 'paste' && (
        <Panel
          title="Direct paste"
          note="Paste CSV with a header row, or a JSON array of records."
          actions={
            <>
              <input
                className="input mono"
                style={{ width: 220 }}
                type="text"
                name="batch-filename"
                autoComplete="off"
                spellCheck={false}
                value={pastedFileName}
                onChange={(e) => setPastedFileName(e.target.value)}
                placeholder="batch_filename.csv"
                aria-label="Batch file name"
              />
              <button className="btn btn-outline btn-sm" onClick={() => setPastedContent(SAMPLE_ALERTS_CSV)}>
                Insert sample
              </button>
            </>
          }
        >
          <textarea
            className="textarea mono"
            value={pastedContent}
            onChange={(e) => setPastedContent(e.target.value)}
            placeholder={'alert_id,entity_id,asset_id,alert_category,source_control,severity,created_at,closed_at,disposition\nALT-01,CSE-A,AST-CSE-A-101,Brute Force,EDR,Critical,2026-09-01T00:00:00Z,2026-09-01T01:00:00Z,True Positive'}
            rows={10}
            disabled={isReadOnly || isProcessing}
            style={{ width: '100%' }}
          />

          <div className="row-between" style={{ marginTop: 12 }}>
            <button className="btn-link" onClick={() => setPastedContent('')}>Clear text</button>
            <button
              className="btn btn-primary"
              onClick={handlePasteSubmit}
              disabled={isReadOnly || isProcessing || !pastedContent.trim()}
            >
              {isProcessing ? 'Parsing…' : 'Process and ingest'} <ArrowRight size={13} />
            </button>
          </div>
        </Panel>
      )}

      {activeInputMethod === 'preset' && (
        <div className="grid-quarters">
          {presets.map((p) => (
            <Panel key={p.title} bodyClassName="panel-body" className="preset-card">
              <div className="row-between" style={{ marginBottom: 8 }}>
                <Badge tone={p.tone}>{p.tag}</Badge>
                <span className="text-xs dim">{p.meta}</span>
              </div>
              <div className="title-sm" style={{ fontSize: 13.5, marginBottom: 5 }}>{p.title}</div>
              <p className="text-xs muted" style={{ margin: '0 0 14px' }}>{p.body}</p>
              <div className="stack-8">
                <button
                  className="btn btn-primary"
                  onClick={p.primary.run}
                  disabled={isReadOnly || isProcessing}
                >
                  {p.primary.label}
                </button>
                {p.secondary && (
                  <button className="btn btn-outline" onClick={p.secondary.run}>
                    <Download size={13} /> {p.secondary.label}
                  </button>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {lastSummary && (
        <Panel
          title="Batch ingested successfully"
          note={`${lastSummary.fileName} · ${formatBytes(lastSummary.fileSize)} · SHA-256 ${formatShortHash(lastSummary.sha256Hash, 16)}`}
          actions={
            <button className="btn btn-outline" onClick={handleDownloadCurrentNormalized}>
              <Download size={13} /> Export normalised JSON
            </button>
          }
        >
          <div className="callout callout-ok" style={{ marginBottom: 16 }}>
            <Check size={15} />
            <div>
              Parsed in <strong>{lastSummary.mode === 'replace' ? 'replace' : 'append'}</strong> mode. All views
              have been recalculated against this dataset.
            </div>
          </div>

          <div className="stat-grid stagger">
            <Stat label="Entities" value={lastSummary.recordCounts.entities} />
            <Stat label="Assets" value={lastSummary.recordCounts.assets} />
            <Stat label="Alerts" value={lastSummary.recordCounts.alerts} tone="high" />
            <Stat label="Cases" value={lastSummary.recordCounts.cases} />
            <Stat label="Escalations" value={lastSummary.recordCounts.escalations} tone="accent" />
          </div>

          <div className="section-title" style={{ marginTop: 20 }}>Continue to</div>
          <div className="grid-quarters">
            {[
              ['Overview dashboard', onNavigateToOverview],
              ['Entity ranking', onNavigateToLeaderboard],
              ['Review queue', onNavigateToQueue],
              ['Findings', onNavigateToFindings],
            ].map(([label, action]) => (
              <button
                key={label as string}
                className="btn btn-outline"
                style={{ justifyContent: 'space-between' }}
                onClick={action as () => void}
              >
                {label as string} <ArrowRight size={13} />
              </button>
            ))}
          </div>
        </Panel>
      )}

      <Panel
        title="Submission schema"
        note="Only alerts.csv is mandatory; the remaining tables enrich the analysis when present."
        actions={
          <>
            <button className="btn btn-sm btn-outline" onClick={handleDownloadSampleZip}>
              <Archive size={12} /> Sample .zip
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={() =>
                downloadBlob('soc_alerts_template.csv', SAMPLE_ALERTS_CSV, 'text/csv;charset=utf-8;')
              }
            >
              <Download size={12} /> CSV template
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={() =>
                downloadBlob('soc_enclave_template.json', JSON.stringify(SAMPLE_JSON_DATASET, null, 2), 'application/json')
              }
            >
              <Download size={12} /> JSON template
            </button>
            <button className="btn btn-sm btn-outline" onClick={copyTemplateToClipboard}>
              {copiedTemplate ? <Check size={12} /> : <Copy size={12} />}
              {copiedTemplate ? 'Copied' : 'Copy headers'}
            </button>
          </>
        }
        bodyClassName=""
      >
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 180 }}>File</th>
                <th style={{ width: 110 }}>Requirement</th>
                <th>Columns</th>
              </tr>
            </thead>
            <tbody>
              {SCHEMAS.map((s) => (
                <tr key={s.file}>
                  <td className="mono cell-strong">{s.file}</td>
                  <td>
                    <Badge tone={s.required ? 'accent' : 'neutral'}>
                      {s.required ? 'mandatory' : 'optional'}
                    </Badge>
                  </td>
                  <td className="mono text-xs">{s.columns}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {!lastSummary && (
        <Panel>
          <EmptyState>
            No batch has been ingested in this session. The active dataset is{' '}
            <strong style={{ color: 'var(--fg-2)' }}>{activeDatasetName}</strong>.
          </EmptyState>
        </Panel>
      )}
    </div>
  );
};
