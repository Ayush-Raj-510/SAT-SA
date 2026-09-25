import React, { useMemo } from 'react';
import { Download, RefreshCw, Target, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { GroundTruthTag, SyntheticDataset } from '../data/syntheticGenerator';
import { EntityRiskScore, FindingRecord, ReviewQueueItem, DataQualityReport } from '../types';
import { PageHeader, Panel, Badge, Stat, EmptyState, Meter, Callout } from './ui';
import { formatPercent } from '../engine/format';

interface SyntheticBenchmarkTabProps {
  dataset: SyntheticDataset;
  entityScores: EntityRiskScore[];
  findings: FindingRecord[];
  reviewQueue: ReviewQueueItem[];
  onRegenerateData: () => void;
  dataQuality?: DataQualityReport;
}

/**
 * Maps each injected scenario in the ground-truth manifest to the detector that
 * is supposed to catch it. Coverage below is computed from that mapping against
 * the findings actually produced, so the figures cannot drift from the engine.
 */
const SCENARIOS: {
  issueType: string;
  label: string;
  detector: string;
  detectorLabel: string;
  dqRule?: string;
  expectation: string;
}[] = [
  {
    issueType: 'fast_closure',
    label: 'Rapid closure of high-severity alerts',
    detector: 'EXEC-FAST-CLOSE-001',
    detectorLabel: 'Fast closure detector',
    expectation: 'Critical or high alerts closed far inside the peer interquartile range.',
  },
  {
    issueType: 'escalation_bypass',
    label: 'High-impact case closed without escalation',
    detector: 'EXEC-ESC-BYPASS-002',
    detectorLabel: 'Escalation bypass detector',
    expectation: 'Critical impact cases with no linked escalation record.',
  },
  {
    issueType: 'repetitive_notes',
    label: 'Near-duplicate investigation notes',
    detector: 'EXEC-REP-NOTES-003',
    detectorLabel: 'Repetitive notes detector',
    expectation: 'Identical boilerplate text reused across unrelated assets.',
  },
  {
    issueType: 'silent_critical_asset',
    label: 'Silent critical asset',
    detector: 'NEG-SILENT-ASSET-004',
    detectorLabel: 'Silent asset detector',
    expectation: 'Critical OT or IT asset with zero alerts in the whole period.',
  },
  {
    issueType: 'coverage_drop',
    label: 'Abrupt telemetry coverage drop',
    detector: 'NEG-COVERAGE-DROP-005',
    detectorLabel: 'Coverage drop detector',
    expectation: 'Active asset count falling sharply against the prior quarter.',
  },
  {
    issueType: 'data_quality_duplicate_id',
    label: 'Duplicate record identifiers',
    detector: 'DQ-DUP-ALERT',
    detectorLabel: 'Duplicate identifier rule',
    dqRule: 'DQ-DUP-ALERT',
    expectation: 'Primary keys reused within a submission table.',
  },
  {
    issueType: 'data_quality_temporal_inversion',
    label: 'Temporal inversion',
    detector: 'DQ-TIME-INVERT',
    detectorLabel: 'Temporal inversion rule',
    dqRule: 'DQ-TIME-INVERT',
    expectation: 'Records closed before their creation timestamp.',
  },
  {
    issueType: 'data_quality_orphan_case',
    label: 'Orphan case record',
    detector: 'DQ-REL-ORPHAN-CASE',
    detectorLabel: 'Orphan relationship rule',
    dqRule: 'DQ-REL-ORPHAN-CASE',
    expectation: 'Cases referencing an alert identifier that does not exist.',
  },
];

const KNOWN_ISSUE_TYPES = new Set(SCENARIOS.map((s) => s.issueType));

export const SyntheticBenchmarkTab: React.FC<SyntheticBenchmarkTabProps> = ({
  dataset,
  entityScores,
  findings,
  reviewQueue,
  onRegenerateData,
  dataQuality,
}) => {
  const labels = dataset.ground_truth_labels;

  const evaluation = useMemo(() => {
    const flaggedDqRules = new Set((dataQuality?.issues ?? []).map((i) => i.id));

    const rows = SCENARIOS.map((scenario) => {
      const tags = labels.filter((t) => t.injected_issue_type === scenario.issueType);
      const entities = Array.from(new Set(tags.map((t) => t.entity_id)));

      // Detector-backed scenarios are evaluated per entity; data-quality rules
      // are global to the submission, so they are evaluated once.
      const isGlobal = Boolean(scenario.dqRule);
      const detected = isGlobal
        ? flaggedDqRules.has(scenario.dqRule as string)
        : entities.some((entityId) =>
            findings.some((f) => f.entity_id === entityId && f.rule_id === scenario.detector),
          );

      return {
        ...scenario,
        records: tags.length,
        entities,
        detected,
        isGlobal,
      };
    });

    const withRecords = rows.filter((r) => r.records > 0);
    const covered = withRecords.filter((r) => r.detected).length;

    return {
      rows,
      withRecords,
      covered,
      coverage: withRecords.length ? Math.round((covered / withRecords.length) * 100) : 0,
    };
  }, [labels, findings, dataQuality]);

  const knownIssueEntities = useMemo(
    () =>
      Array.from(
        new Set(labels.filter((t) => KNOWN_ISSUE_TYPES.has(t.injected_issue_type)).map((t) => t.entity_id)),
      ),
    [labels],
  );

  const top3 = entityScores.slice(0, 3).map((e) => e.entity_id);
  const knownInTop3 = top3.filter((id) => knownIssueEntities.includes(id)).length;
  const prioritisationPrecision = knownInTop3 / 3;

  const totalAlerts = dataset.alerts.length;
  const reductionRatio = totalAlerts ? Math.round((1 - reviewQueue.length / totalAlerts) * 100) : 0;

  const scenarioRows = useMemo(() => {
    const flaggedDqRules = new Set((dataQuality?.issues ?? []).map((i) => i.id));

    return entityScores.map((score) => {
      const tags: GroundTruthTag[] = labels.filter((t) => t.entity_id === score.entity_id);
      const types = Array.from(new Set(tags.map((t) => t.injected_issue_type)));
      const mapped = types
        .map((t) => SCENARIOS.find((s) => s.issueType === t))
        .filter(Boolean) as typeof SCENARIOS;

      const detected = mapped.filter((s) =>
        s.dqRule
          ? flaggedDqRules.has(s.dqRule)
          : findings.some((f) => f.entity_id === score.entity_id && f.rule_id === s.detector),
      );

      // Entities carrying no labels are the control cases: nothing was injected.
      const control = types.length === 0;

      return {
        entityId: score.entity_id,
        entityName: score.entity_name,
        rank: score.rank,
        control,
        types,
        detectors: mapped.map((s) => s.detectorLabel),
        detectedCount: detected.length,
        expectedCount: mapped.length,
        description: tags[0]?.description ?? '',
      };
    });
  }, [labels, entityScores, findings, dataQuality]);

  const downloadJSON = (fileName: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadGroundTruthJSON = () =>
    downloadJSON('sat_sa_ground_truth_manifest.json', labels);

  const downloadFullDatasetJSON = () =>
    downloadJSON('sat_sa_synthetic_submission_package.json', {
      manifest: {
        dataset_version: dataset.dataset_version,
        generated_at: dataset.generation_timestamp,
        entities_count: dataset.entities.length,
        alerts_count: dataset.alerts.length,
        cases_count: dataset.cases.length,
        escalations_count: dataset.escalations.length,
      },
      entities: dataset.entities,
      assets: dataset.assets,
      alerts: dataset.alerts,
      cases: dataset.cases,
      escalations: dataset.escalations,
    });

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Section 19 — controlled validation"
        title="Ground-truth evaluation matrix"
        description="The reference dataset carries independently stored ground-truth labels recording which deficiencies were injected. Detectors never read those labels; they are used only to evaluate detection after the fact."
        actions={
          <>
            <button className="btn btn-outline" onClick={onRegenerateData}>
              <RefreshCw size={13} /> Regenerate dataset
            </button>
            <button className="btn btn-primary" onClick={downloadFullDatasetJSON}>
              <Download size={13} /> Download submission bundle
            </button>
          </>
        }
      />

      <div className="stat-grid stagger">
        <Stat
          label="Scenario coverage"
          value={evaluation.coverage}
          unit="%"
          tone={evaluation.coverage >= 80 ? 'low' : evaluation.coverage >= 50 ? 'high' : 'critical'}
          hint={`${evaluation.covered} of ${evaluation.withRecords.length} injected scenarios produced a finding.`}
        />
        <Stat
          label="Known-issue entities in top 3"
          value={`${knownInTop3}/3`}
          tone={knownInTop3 === 3 ? 'low' : 'high'}
          hint={`Prioritisation precision ${formatPercent(prioritisationPrecision * 100, 0)}.`}
        />
        <Stat
          label="Review reduction"
          value={reductionRatio}
          unit="%"
          hint={`${totalAlerts} alerts reduced to ${reviewQueue.length} prioritised items.`}
        />
        <Stat
          label="Ground-truth labels"
          value={labels.length}
          hint="Independently stored and excluded from the analytics input."
        />
      </div>

      <Callout tone="info" icon={<Info size={15} />} title="Figures are computed, not asserted">
        Coverage is derived by matching each injected scenario to the detector expected to catch it and
        checking the findings actually produced by the engine in this run. Hardcoded benchmark values would
        silently drift away from detector behaviour.
      </Callout>

      <Panel title="Detection coverage by injected scenario">
        <div className="stack-8">
          {evaluation.rows.map((row) => (
            <div className="inset" key={row.issueType} style={{ padding: 12 }}>
              <div className="row-between" style={{ marginBottom: 6 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="mono text-xs dim">{row.detector}</span>
                  <span className="title-sm">{row.label}</span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="text-xs dim nowrap">
                    {row.records} label{row.records === 1 ? '' : 's'}
                    {row.entities.length > 0 && ` · ${row.entities.length} entit${row.entities.length === 1 ? 'y' : 'ies'}`}
                  </span>
                  {row.records === 0 ? (
                    <Badge tone="neutral">not injected</Badge>
                  ) : row.detected ? (
                    <Badge tone="low">
                      <CheckCircle2 size={11} /> detected
                    </Badge>
                  ) : (
                    <Badge tone="critical">
                      <AlertTriangle size={11} /> missed
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-xs muted">{row.expectation}</div>
              {row.entities.length > 0 && (
                <div className="row" style={{ gap: 5, marginTop: 7 }}>
                  {row.entities.map((id) => (
                    <span className="chip" key={id}>
                      {id} · {entityScores.find((e) => e.entity_id === id)?.entity_name ?? 'unknown'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Injected scenarios per entity"
        note="Ranks are read from the live ranking, so this table cannot disagree with the leaderboard."
        actions={
          <button className="btn btn-sm btn-outline" onClick={downloadGroundTruthJSON}>
            <Download size={12} /> Ground-truth labels ({labels.length})
          </button>
        }
        bodyClassName=""
      >
        {scenarioRows.length === 0 ? (
          <EmptyState icon={<Target />}>No ground-truth labels are present in the active dataset.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Rank</th>
                  <th style={{ width: 210 }}>Entity</th>
                  <th style={{ width: 260 }}>Injected condition</th>
                  <th>Expected supervisory signal</th>
                  <th style={{ width: 150 }}>Detector outcome</th>
                </tr>
              </thead>
              <tbody>
                {scenarioRows.map((row) => (
                  <tr key={row.entityId}>
                    <td className="cell-strong mono">#{row.rank}</td>
                    <td>
                      <div className="cell-strong">{row.entityName}</div>
                      <div className="cell-sub mono">{row.entityId}</div>
                    </td>
                    <td>
                      {row.control ? (
                        <Badge tone="low">control — nothing injected</Badge>
                      ) : (
                        <div className="row" style={{ gap: 4 }}>
                          {row.types.map((t) => (
                            <span className="chip" key={t}>{t}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="text-xs muted">{row.description}</div>
                      {row.detectors.length > 0 && (
                        <div className="cell-sub">{row.detectors.join(' · ')}</div>
                      )}
                    </td>
                    <td>
                      {row.control ? (
                        <span className="text-xs dim">no finding expected</span>
                      ) : (
                        <div>
                          <div className="row" style={{ gap: 6 }}>
                            <span className="mono text-xs fg">
                              {row.detectedCount}/{row.expectedCount}
                            </span>
                            {row.detectedCount === row.expectedCount ? (
                              <CheckCircle2 size={12} color="var(--ok)" />
                            ) : (
                              <AlertTriangle size={12} color="var(--warn)" />
                            )}
                          </div>
                          <div style={{ marginTop: 5 }}>
                            <Meter
                              value={row.expectedCount ? (row.detectedCount / row.expectedCount) * 100 : 0}
                              tone={row.detectedCount === row.expectedCount ? 'ok' : 'warn'}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Dataset provenance">
        <dl className="kv-grid">
          {[
            ['Dataset version', dataset.dataset_version],
            ['Generated at', dataset.generation_timestamp],
            ['Entities', String(dataset.entities.length)],
            ['Assets', String(dataset.assets.length)],
            ['Alerts', String(dataset.alerts.length)],
            ['Cases', String(dataset.cases.length)],
            ['Escalations', String(dataset.escalations.length)],
            ['Ground-truth labels', String(labels.length)],
          ].map(([label, value]) => (
            <div className="kv" key={label}>
              <dt>{label}</dt>
              <dd className="mono">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
};
