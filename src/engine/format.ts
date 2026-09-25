/**
 * Display formatting for SAT-SA.
 *
 * An examiner reads the same value in the ranking table, the finding detail,
 * the audit trail and the printable report. If those four places disagree on
 * how a timestamp or a count looks, the console stops reading as one
 * instrument — so every human-readable value is formatted here and nowhere
 * else.
 *
 * Timestamps are rendered in UTC and always carry the zone label. This console
 * is used to reason about the ordering of events inside a batch submission, so
 * an unlabelled, machine-local time would be a reproducibility hazard in an
 * audit trail.
 */

const LOCALE = 'en-GB';

const TIMESTAMP_SECONDS = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

const TIMESTAMP_MINUTES = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

const DATE_ONLY = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const TIME_ONLY = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

/** Parse an ISO-8601 string or Date. Returns null rather than an Invalid Date. */
const toDate = (value: string | number | Date | null | undefined): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Full audit timestamp — `15 Aug 2026, 09:00:00 UTC`.
 * Use wherever the exact instant matters: audit entries, run manifests.
 */
export const formatTimestamp = (value: string | number | Date | null | undefined): string => {
  const date = toDate(value);
  return date ? `${TIMESTAMP_SECONDS.format(date)} UTC` : '—';
};

/**
 * Minute-resolution timestamp — `15 Aug 2026, 09:00 UTC`.
 * Use in dense tables where a column has no room for seconds.
 */
export const formatTimestampShort = (value: string | number | Date | null | undefined): string => {
  const date = toDate(value);
  return date ? `${TIMESTAMP_MINUTES.format(date)} UTC` : '—';
};

/** Calendar date only — `15 Aug 2026`. */
export const formatDate = (value: string | number | Date | null | undefined): string => {
  const date = toDate(value);
  return date ? DATE_ONLY.format(date) : '—';
};

/** Clock time only — `09:00:00 UTC`. */
export const formatTime = (value: string | number | Date | null | undefined): string => {
  const date = toDate(value);
  return date ? `${TIME_ONLY.format(date)} UTC` : '—';
};

/** Grouped integer or decimal — `1,284`, `91.5`. */
export const formatNumber = (value: number, maxFractionDigits = 0): string => {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
};

/** A 0–100 index value with a fixed precision — `91.5`. */
export const formatScore = (value: number, digits = 1): string => {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
};

/**
 * Share of a whole — `12.4%`.
 * `value` is already a percentage (0–100), matching the engine's convention.
 */
export const formatPercent = (value: number, digits = 1): string => {
  if (!Number.isFinite(value)) return '—';
  return `${formatScore(value, digits)}%`;
};

/** Binary file size — `412 KB`. */
export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${formatNumber(value, digits)} ${units[unit]}`;
};

/** Truncate an opaque identifier for display — `e3b0c442…b855`. */
export const shortenIdentifier = (value: string, head = 16, tail = 4): string => {
  if (!value) return '';
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
};
