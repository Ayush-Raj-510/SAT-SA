import React from 'react';

/* =========================================================================
   Shared presentation primitives for SAT-SA.
   These exist so that every screen composes the same header, panel, badge and
   empty-state markup. Keeping the vocabulary small is what makes the console
   read as one product rather than a set of separately-styled pages.
   ========================================================================= */

/* ------------------------------------------------------------------ badges */

export type Tone = 'neutral' | 'accent' | 'critical' | 'high' | 'medium' | 'low';

const SEVERITY_TONE: Record<string, Tone> = {
  Critical: 'critical',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
};

export const severityTone = (severity?: string): Tone =>
  SEVERITY_TONE[severity ?? ''] ?? 'neutral';

const BAND_TONE: Record<string, Tone> = {
  'Very High': 'critical',
  Critical: 'critical',
  High: 'high',
  Moderate: 'medium',
  Medium: 'medium',
  Low: 'low',
};

export const bandTone = (band?: string): Tone => BAND_TONE[band ?? ''] ?? 'neutral';

const STATUS_TONE: Record<string, Tone> = {
  'Verified Issue': 'critical',
  'Under Review': 'medium',
  'Exception Noted': 'accent',
  'False Positive': 'low',
  Pending: 'neutral',
};

export const statusTone = (status?: string): Tone => STATUS_TONE[status ?? ''] ?? 'neutral';

export const Badge: React.FC<{
  tone?: Tone;
  mono?: boolean;
  className?: string;
  title?: string;
  children: React.ReactNode;
}> = ({ tone = 'neutral', mono = false, className = '', title, children }) => (
  <span
    className={`badge badge-${tone}${mono ? ' badge-mono' : ''}${className ? ' ' + className : ''}`}
    title={title}
  >
    {children}
  </span>
);

/* ------------------------------------------------------------------ meters */

export const Meter: React.FC<{ value: number; tone?: 'accent' | 'danger' | 'warn' | 'ok'; label?: string }> = ({
  value,
  tone = 'accent',
  label,
}) => {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={`meter meter-${tone}`} role="img" aria-label={label ?? `${clamped}%`} title={label ?? `${clamped}%`}>
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
};

/* ------------------------------------------------------------------ panels */

export const Panel: React.FC<{
  title?: React.ReactNode;
  note?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
  className?: string;
  hoverable?: boolean;
  children: React.ReactNode;
}> = ({ title, note, actions, footer, bodyClassName = 'panel-body', className = '', children, hoverable = false }) => (
  <section className={`panel${hoverable ? ' panel-hover' : ''}${className ? ' ' + className : ''}`}>
    {(title || actions) && (
      <header className="panel-head">
        <div>
          {title && <h3 className="panel-title">{title}</h3>}
          {note && <p className="panel-note" style={{ margin: '3px 0 0' }}>{note}</p>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </header>
    )}
    <div className={bodyClassName}>{children}</div>
    {footer && <footer className="panel-foot">{footer}</footer>}
  </section>
);

/* -------------------------------------------------------------- page header */

export const PageHeader: React.FC<{
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ eyebrow, title, description, actions }) => (
  <div className="page-head">
    <div>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="page-title">{title}</h2>
      {description && <p className="page-sub">{description}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
);

/* --------------------------------------------------------------- stat block */

export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  tone?: 'default' | Tone;
  icon?: React.ReactNode;
}> = ({ label, value, unit, hint, tone = 'default', icon }) => {
  const color =
    tone === 'critical' ? 'var(--danger)'
    : tone === 'high' ? 'var(--warn)'
    : tone === 'medium' ? 'var(--info)'
    : tone === 'low' ? 'var(--ok)'
    : tone === 'accent' ? 'var(--accent-hi)'
    : undefined;
  return (
    <div className="stat">
      <div className="stat-label">
        <span>{label}</span>
        {icon}
      </div>
      <div className="stat-value" style={color ? { color } : undefined}>
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
};

/* --------------------------------------------------------------- callout */

export const Callout: React.FC<{
  tone?: 'info' | 'accent' | 'warn' | 'danger' | 'ok';
  icon?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ tone = 'info', icon, title, children }) => (
  <div className={`callout callout-${tone}`}>
    {icon}
    <div>
      {title && <div style={{ color: 'var(--fg)', fontWeight: 600, marginBottom: children ? 3 : 0 }}>{title}</div>}
      {children}
    </div>
  </div>
);

/* ------------------------------------------------------------ empty state */

export const EmptyState: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="empty">
    {icon}
    {children}
  </div>
);

/* ------------------------------------------------------------- form fields */

export const Field: React.FC<{
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, htmlFor, hint, children }) => (
  <div className="field">
    <label className="label" htmlFor={htmlFor}>{label}</label>
    {children}
    {hint && <div className="hint">{hint}</div>}
  </div>
);

/* ------------------------------------------------------------ search input */

export const SearchInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  'aria-label'?: string;
}> = ({ value, onChange, placeholder, ...rest }) => (
  <div className="field-icon" style={{ minWidth: 240, flex: '1 1 240px' }}>
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.6 10.6 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
    <input
      className="input"
      type="search"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      aria-label={rest['aria-label'] ?? placeholder ?? 'Search'}
    />
  </div>
);

/* ------------------------------------------------------------- key / value */

export const KeyValueGrid: React.FC<{ items: { label: string; value: React.ReactNode }[] }> = ({ items }) => (
  <dl className="kv-grid">
    {items.map((it) => (
      <div className="kv" key={it.label}>
        <dt>{it.label}</dt>
        <dd>{it.value}</dd>
      </div>
    ))}
  </dl>
);

/* ------------------------------------------------------------ filter select */

export const FilterSelect: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <label className="row" style={{ gap: 6, fontSize: 11.5, color: 'var(--fg-3)' }}>
    <span className="nowrap">{label}</span>
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 'auto', minWidth: 130 }}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </label>
);

/* --------------------------------------------------------------- copy button */

export const CopyButton: React.FC<{ value: string; label?: string }> = ({ value, label = 'Copy' }) => {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm btn-outline"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          },
          () => undefined,
        );
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  );
};

/* ------------------------------------------------------------- modal shell */

/**
 * Shared dialog behaviour: Escape closes, focus moves into the dialog on open
 * and returns to whatever opened it on close. Without this a keyboard user is
 * left behind the overlay with no way back to the control they came from.
 */
const useDialogBehaviour = (onClose: () => void, containerRef: React.RefObject<HTMLDivElement | null>) => {
  // Callers pass an inline arrow, so depending on it directly would re-run the
  // effect on every render and pull focus back to the dialog mid-interaction.
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  // Captured during the first render, not in an effect: the trigger is often
  // unmounted by the very state change that opens the dialog (e.g. a menu
  // item closing its own menu), so by effect time activeElement is already
  // body and the original trigger is lost.
  const restoreTargetRef = React.useRef<HTMLElement | null>(null);
  if (restoreTargetRef.current === null) {
    restoreTargetRef.current = document.activeElement as HTMLElement | null;
  }

  React.useEffect(() => {
    const container = containerRef.current;

    // Only claim focus if nothing inside the dialog already took it — an input
    // with autoFocus must win, otherwise the user has to click before typing.
    if (container && !container.contains(document.activeElement)) {
      container.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const target = restoreTargetRef.current;
      if (target && target !== document.body && target.isConnected) {
        target.focus();
      } else {
        // No meaningful trigger (nothing focused, or it unmounted). Land
        // keyboard users on the main landmark instead of the document top.
        const main = document.querySelector<HTMLElement>('main[tabindex="-1"], main');
        main?.focus();
      }
    };
  }, [containerRef]);
};

export const Modal: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  width?: number;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  printable?: boolean;
  bodyClassName?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, onClose, width = 860, actions, footer, printable = false, bodyClassName = 'modal-body', children }) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  useDialogBehaviour(onClose, dialogRef);

  return (
    <div className="overlay anim-overlay">
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`modal anim-dialog${printable ? ' printable' : ''}`}
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="modal-head">
          <div>
            <h3 className="modal-title" id={titleId}>{title}</h3>
            {subtitle && <div className="text-xs dim" style={{ marginTop: 2 }}>{subtitle}</div>}
          </div>
          <div className="row no-print">
            {actions}
            <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close dialog">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>
        <div className={bodyClassName}>{children}</div>
        {footer && <footer className="modal-foot no-print">{footer}</footer>}
      </div>
    </div>
  );
};

/* --------------------------------------------------------- confirm dialog */

/**
 * Guard for actions that destroy or replace state. The confirm button states
 * the outcome rather than saying "OK", and the destructive path is never the
 * default that receives focus first.
 */
export const ConfirmDialog: React.FC<{
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'danger' | 'accent';
  children: React.ReactNode;
}> = ({ title, confirmLabel, onConfirm, onCancel, tone = 'danger', children }) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const titleId = React.useId();
  useDialogBehaviour(onCancel, dialogRef);

  React.useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div className="overlay anim-overlay">
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="modal confirm-dialog anim-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="modal-head">
          <h3 className="modal-title" id={titleId}>{title}</h3>
        </header>
        <div className="modal-body">{children}</div>
        <footer className="modal-foot">
          <span className="text-xs dim">Nothing changes until you confirm.</span>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" ref={cancelRef} className="btn btn-outline" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className={tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
