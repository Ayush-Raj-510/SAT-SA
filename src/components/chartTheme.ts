/**
 * Shared Recharts styling. Charts previously each carried their own inline
 * tooltip/axis colours, which drifted apart. One object keeps them consistent.
 *
 * Colours mirror the light-theme tokens in index.css. They are duplicated as
 * literals because Recharts reads SVG attributes, not CSS custom properties.
 */

export const CHART = {
  grid: 'rgba(19, 38, 68, 0.07)',
  axis: 'rgba(19, 38, 68, 0.16)',
  tick: { fontSize: 11, fill: '#5e6b7c' } as const,
  tickSm: { fontSize: 10.5, fill: '#5e6b7c' } as const,
  cursor: { fill: 'rgba(19, 38, 68, 0.05)' } as const,
  tooltip: {
    backgroundColor: '#ffffff',
    border: '1px solid #dbe2ea',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 12,
    color: '#1d2836',
    boxShadow: '0 10px 28px rgba(16, 42, 82, 0.14)',
  } as const,
  tooltipLabel: { color: '#5e6b7c', fontSize: 11, marginBottom: 4 } as const,
  tooltipItem: { color: '#1d2836', fontSize: 12 } as const,
  legend: { fontSize: 11, paddingTop: 10, color: '#5e6b7c' } as const,
};

/** Series colours for multi-entity charts, in a deliberately low-saturation set. */
export const SERIES_COLORS = [
  '#2f66d8',
  '#96560f',
  '#c23d3d',
  '#177a56',
  '#2b7cc0',
  '#7c55c9',
  '#5e6b7c',
  '#a4613c',
];

export const RISK_COLOR = (score: number): string =>
  score >= 75 ? '#c23d3d' : score >= 50 ? '#96560f' : score >= 25 ? '#2f66d8' : '#177a56';
