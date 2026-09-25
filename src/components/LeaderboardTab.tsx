import React, { useState, useMemo } from 'react';
import { Download, Info, ChevronRight } from 'lucide-react';
import { EntityRiskScore } from '../types';
import { PageHeader, Panel, Badge, Meter, FilterSelect, SearchInput, EmptyState, bandTone } from './ui';
import { RISK_COLOR } from './chartTheme';

interface LeaderboardTabProps {
  entityScores: EntityRiskScore[];
  onSelectEntity: (entityId: string) => void;
  /** Retained for API compatibility; the table exports the filtered view. */
  onExport?: () => void;
}

const SECTORS = [
  'Power & Energy',
  'Banking & Financial',
  'Telecommunications',
  'Civil Aviation & Transport',
  'Strategic & Defense',
  'Healthcare & Public Governance',
];

const BANDS = ['Very High', 'High', 'Moderate', 'Low'];

type SortKey =
  | 'rank'
  | 'entity_name'
  | 'overall_risk_score'
  | 'execution_gap_score'
  | 'negative_space_score'
  | 'trend_deterioration_score'
  | 'data_quality_score';

export const LeaderboardTab: React.FC<LeaderboardTabProps> = ({
  entityScores,
  onSelectEntity,
  onExport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [selectedBand, setSelectedBand] = useState('ALL');
  const [showFormula, setShowFormula] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortAsc, setSortAsc] = useState(true);

  const filteredEntities = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const rows = entityScores.filter((entity) => {
      const matchesSearch =
        !term ||
        entity.entity_name.toLowerCase().includes(term) ||
        entity.entity_id.toLowerCase().includes(term);
      const matchesSector = selectedSector === 'ALL' || entity.sector === selectedSector;
      const matchesBand = selectedBand === 'ALL' || entity.prioritization_band === selectedBand;
      return matchesSearch && matchesSector && matchesBand;
    });

    const sorted = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv);
      return Number(av) - Number(bv);
    });
    return sortAsc ? sorted : sorted.reverse();
  }, [entityScores, searchTerm, selectedSector, selectedBand, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(key === 'rank' || key === 'entity_name');
    }
  };

  const exportCSV = () => {
    const headers = [
      'Rank', 'Entity ID', 'Entity Name', 'Sector', 'Peer Group', 'Composite Risk Score',
      'Risk Band', 'Execution Gap Score', 'Negative Space Score', 'Trend Deterioration Score',
      'Peer Deviation Score', 'Data Quality Score', 'Confidence',
    ];
    const rows = filteredEntities.map((e) => [
      e.rank, e.entity_id, `"${e.entity_name.replace(/"/g, "'")}"`, `"${e.sector}"`,
      `"${e.peer_group}"`, e.overall_risk_score, e.prioritization_band,
      e.execution_gap_score, e.negative_space_score, e.trend_deterioration_score,
      e.unexplained_peer_deviation_score, e.data_quality_score, e.confidence_label,
    ]);

    const csv =
      '# SAT-SA export: entity risk ranking\n' +
      `# Exported: ${new Date().toISOString()}\n\n` +
      headers.join(',') + '\n' + rows.map((r) => r.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sat_sa_entity_ranking_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortAsc ? ' ▲' : ' ▼') : '');

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Entity ranking"
        title="Composite supervisory risk ranking"
        description="Deterministic, fully auditable ordering of entities by weighted deficiency score. Bands express supervisory attention, not compliance grading."
        actions={
          <>
            <button className="btn btn-outline" onClick={() => setShowFormula((v) => !v)} aria-expanded={showFormula}>
              <Info size={13} /> Method
            </button>
            <button className="btn btn-outline" onClick={onExport}>
              <Download size={13} /> Standard export
            </button>
            <button className="btn btn-primary" onClick={exportCSV}>
              <Download size={13} /> Export filtered CSV
            </button>
          </>
        }
      />

      {showFormula && (
        <Panel title="Scoring method and bands">
          <div className="stack-12">
            <pre className="codeblock">{`EntityRisk = 0.40 × ExecutionGap
           + 0.35 × NegativeSpace
           + 0.15 × TrendDeterioration
           + 0.10 × UnexplainedPeerDeviation`}</pre>
            <div className="grid-quarters">
              {[
                ['75 – 100', 'Very high attention', 'danger'],
                ['50 – 74', 'High attention', 'warn'],
                ['25 – 49', 'Moderate attention', 'accent'],
                ['0 – 24', 'Low attention', 'ok'],
              ].map(([range, label, tone]) => (
                <div className="inset" key={range} style={{ padding: 12 }}>
                  <div
                    className="mono"
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color:
                        tone === 'danger' ? 'var(--danger)'
                        : tone === 'warn' ? 'var(--warn)'
                        : tone === 'accent' ? 'var(--accent-hi)'
                        : 'var(--ok)',
                    }}
                  >
                    {range}
                  </div>
                  <div className="text-xs muted" style={{ marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>
            <p className="text-xs dim" style={{ margin: 0 }}>
              Bands prioritise supervisory workload. They are not compliance grades or penalty notices,
              and each score resolves to row-level evidence held in the run manifest.
            </p>
          </div>
        </Panel>
      )}

      <Panel bodyClassName="panel-body panel-body-tight">
        <div className="row-between">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by entity name or ID"
            aria-label="Search entities"
          />
          <div className="row" style={{ gap: 12 }}>
            <FilterSelect
              label="Sector"
              value={selectedSector}
              onChange={setSelectedSector}
              options={[{ value: 'ALL', label: 'All sectors' }, ...SECTORS.map((s) => ({ value: s, label: s }))]}
            />
            <FilterSelect
              label="Band"
              value={selectedBand}
              onChange={setSelectedBand}
              options={[{ value: 'ALL', label: 'All bands' }, ...BANDS.map((b) => ({ value: b, label: b }))]}
            />
            <span className="text-xs dim nowrap">
              {filteredEntities.length} of {entityScores.length}
            </span>
          </div>
        </div>
      </Panel>

      <Panel bodyClassName="">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th
                  style={{ width: 56, cursor: 'pointer' }}
                  onClick={() => toggleSort('rank')}
                  aria-sort={sortKey === 'rank' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                >
                  Rank{sortIndicator('rank')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('entity_name')}>
                  Entity{sortIndicator('entity_name')}
                </th>
                <th style={{ width: 190 }}>Sector / cohort</th>
                <th
                  className="cell-num"
                  style={{ width: 140, cursor: 'pointer' }}
                  onClick={() => toggleSort('overall_risk_score')}
                >
                  Composite{sortIndicator('overall_risk_score')}
                </th>
                <th
                  className="cell-num"
                  style={{ width: 120, cursor: 'pointer' }}
                  onClick={() => toggleSort('execution_gap_score')}
                >
                  Execution{sortIndicator('execution_gap_score')}
                </th>
                <th
                  className="cell-num"
                  style={{ width: 120, cursor: 'pointer' }}
                  onClick={() => toggleSort('negative_space_score')}
                >
                  Neg. space{sortIndicator('negative_space_score')}
                </th>
                <th
                  className="cell-num"
                  style={{ width: 100, cursor: 'pointer' }}
                  onClick={() => toggleSort('trend_deterioration_score')}
                >
                  Trend{sortIndicator('trend_deterioration_score')}
                </th>
                <th
                  className="cell-num"
                  style={{ width: 110, cursor: 'pointer' }}
                  onClick={() => toggleSort('data_quality_score')}
                >
                  Data quality{sortIndicator('data_quality_score')}
                </th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {filteredEntities.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState>No entities match the current filters.</EmptyState>
                  </td>
                </tr>
              ) : (
                filteredEntities.map((entity) => (
                  <tr key={entity.entity_id} className="is-clickable" onClick={() => onSelectEntity(entity.entity_id)}>
                    <td className="cell-strong mono">{entity.rank}</td>
                    <td>
                      <button
                        type="button"
                        className="row-link"
                        title={`Open ${entity.entity_name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEntity(entity.entity_id);
                        }}
                      >
                        {entity.entity_name}
                      </button>
                      <div className="cell-sub mono">
                        {entity.entity_id} · {entity.reporting_period}
                      </div>
                    </td>
                    <td>
                      <div className="cell-strong" style={{ fontWeight: 400 }}>{entity.sector}</div>
                      <div className="cell-sub">{entity.peer_group}</div>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 7, justifyContent: 'flex-end' }}>
                        <span
                          className="cell-strong"
                          style={{ color: RISK_COLOR(entity.overall_risk_score), minWidth: 22, textAlign: 'right' }}
                        >
                          {entity.overall_risk_score}
                        </span>
                        <div style={{ width: 48 }}>
                          <Meter
                            value={entity.overall_risk_score}
                            tone={entity.overall_risk_score >= 75 ? 'danger' : entity.overall_risk_score >= 50 ? 'warn' : 'accent'}
                          />
                        </div>
                        <Badge tone={bandTone(entity.prioritization_band)}>{entity.prioritization_band}</Badge>
                      </div>
                    </td>
                    <td className="cell-num">{entity.execution_gap_score}</td>
                    <td className="cell-num">{entity.negative_space_score}</td>
                    <td className="cell-num">{entity.trend_deterioration_score}</td>
                    <td className="cell-num">
                      <div>{entity.data_quality_score}</div>
                      <div
                        className="cell-sub"
                        style={{ color: entity.confidence_label === 'High' ? 'var(--ok)' : 'var(--warn)' }}
                      >
                        {entity.confidence_label} confidence
                      </div>
                    </td>
                    <td>
                      <ChevronRight size={14} color="var(--fg-3)" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};
