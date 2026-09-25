import React, { useState, useRef, useEffect } from 'react';
import {
  Lock,
  RefreshCw,
  FileText,
  LogOut,
  KeyRound,
  ChevronDown,
  Check,
  Minus,
} from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import { formatShortHash } from '../engine/crypto';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  runId: string;
  datasetHash: string;
  userRole: UserRole;
  currentUser: UserProfile;
  onOpenLoginModal: () => void;
  onLogout: () => void;

  // Retained for API compatibility with App.tsx. The period selector is no
  // longer rendered in the UI.
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;

  onReRunAnalysis: () => void;
  onOpenReport: () => void;
}

const TABS: { id: string; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'leaderboard', label: 'Entity ranking' },
  { id: 'queue', label: 'Review queue' },
  { id: 'evidence-graph', label: 'Evidence chain' },
  { id: 'findings', label: 'Findings' },
  { id: 'trends', label: 'Trends' },
  { id: 'data-quality', label: 'Data quality' },
  { id: 'benchmark', label: 'Benchmark' },
  { id: 'ingest', label: 'Ingest' },
  { id: 'audit', label: 'Audit' },
  { id: 'ai', label: 'AI analyst' },
];

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  runId,
  datasetHash,
  userRole,
  currentUser,
  onOpenLoginModal,
  onLogout,
  onReRunAnalysis,
  onOpenReport,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const canRunAnalytics = currentUser.permissions.can_re_run_analytics;

  const permissions: { key: keyof UserProfile['permissions']; label: string }[] = [
    { key: 'can_update_review_status', label: 'Triage determinations' },
    { key: 'can_re_run_analytics', label: 'Re-run analytics' },
    { key: 'can_ingest_files', label: 'Submission ingest' },
    { key: 'can_export_audit', label: 'Forensic export' },
    { key: 'can_generate_reports', label: 'Report generation' },
    { key: 'can_configure_rules', label: 'Detector configuration' },
  ];

  return (      <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      {/* ---------------------------------------------------------- status strip */}
      <div
        className="header-status-strip"
        style={{
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--line)',
          padding: '5px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--fg-3)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: '1 1 auto' }}>
          <span style={{ color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, whiteSpace: 'nowrap' }}>
            <Lock size={11} aria-hidden="true" /> AIR-GAPPED ENCLAVE
          </span>
          <Sep />
          <span className="truncate" style={{ minWidth: 0 }}>
            Run {runId} · dataset SHA-256 {formatShortHash(datasetHash, 10)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <span className="hide-sm">No outbound network calls</span>
          <Sep />
          <span>{permissions.filter((p) => currentUser.permissions[p.key]).length}/6 privileges</span>
        </div>
      </div>

      {/* ------------------------------------------------------------- title bar */}
      <div
        className="header-title-bar"
        style={{
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div className="row" style={{ gap: 10 }}>
          <Emblem />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              SAT-SA
            </div>
            <div className="text-xs dim">Supervisory Analytics Tool for SOC Assessment</div>
          </div>
          <span className="badge badge-neutral" style={{ marginLeft: 4 }}>SIH 26157</span>
        </div>

        <div className="row header-actions" style={{ gap: 8 }}>
          {canRunAnalytics ? (
            <button className="btn btn-outline" onClick={onReRunAnalysis} title="Recompute all detectors over the active dataset">
              <RefreshCw size={13} /><span className="header-action-label">Re-run analytics</span>
            </button>
          ) : (
            <button className="btn btn-outline" disabled title="Requires examiner or administrator clearance">
              <Lock size={13} /><span className="header-action-label">Re-run analytics</span>
            </button>
          )}

          <button className="btn btn-primary" onClick={onOpenReport}>
            <FileText size={13} /><span className="header-action-label">Generate report</span>
          </button>

          {/* ---------------------------------------------------------- user menu */}
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              className="btn btn-outline header-user-button"
              onClick={() => setIsUserMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={isUserMenuOpen}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 3,
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent-line)',
                  color: 'var(--accent-hi)',
                  fontSize: 9.5,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {currentUser.avatar_initials}
              </span>
              <span className="hide-sm">{currentUser.name}</span>
              <ChevronDown size={12} />
            </button>

            {isUserMenuOpen && (
              <div
                role="menu"
                className="panel user-menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  width: 320,
                  zIndex: 50,
                  boxShadow: '0 18px 40px rgba(0,0,0,0.55)',
                }}
              >
                <div className="panel-body" style={{ padding: 14 }}>
                  <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 4,
                        flexShrink: 0,
                        background: 'var(--surface-3)',
                        border: '1px solid var(--line-strong)',
                        color: 'var(--fg)',
                        fontWeight: 700,
                        fontSize: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {currentUser.avatar_initials}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{currentUser.name}</div>
                      <div className="text-xs dim">{currentUser.designation}</div>
                      <div className="text-xs dim mono truncate" title={currentUser.email}>{currentUser.email}</div>
                    </div>
                  </div>

                  <hr className="hr" style={{ margin: '12px 0' }} />

                  <dl className="dl" style={{ marginBottom: 12 }}>
                    <div className="dl-row">
                      <dt>Role</dt>
                      <dd>{currentUser.role}</dd>
                    </div>
                    <div className="dl-row">
                      <dt>Badge ID</dt>
                      <dd className="mono">{currentUser.badge_id}</dd>
                    </div>
                    <div className="dl-row">
                      <dt>Clearance</dt>
                      <dd>{currentUser.clearance_level}</dd>
                    </div>
                  </dl>

                  <div className="section-title" style={{ marginBottom: 8 }}>Privileges</div>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 5 }}>
                    {permissions.map((p) => {
                      const granted = currentUser.permissions[p.key];
                      return (
                        <li key={p.key} className="row text-xs" style={{ gap: 6, color: granted ? 'var(--fg-2)' : 'var(--fg-3)' }}>
                          {granted ? (
                            <Check size={12} color="var(--ok)" />
                          ) : (
                            <Minus size={12} color="var(--fg-3)" />
                          )}
                          {p.label}
                        </li>
                      );
                    })}
                  </ul>

                  <hr className="hr" style={{ margin: '12px 0' }} />

                  <div className="row" style={{ gap: 8 }}>
                    <button
                      className="btn btn-outline"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenLoginModal();
                      }}
                    >
                      <KeyRound size={13} /> Switch account
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                    >
                      <LogOut size={13} /> Sign out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ------------------------------------------------------------- tab strip */}
      <nav className="tabstrip" style={{ padding: '0 24px' }} aria-label="Sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className="tab"
            data-active={currentTab === tab.id}
            aria-current={currentTab === tab.id ? 'page' : undefined}
            onClick={() => setCurrentTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
};

/* A hairline rule reads as separation without competing with the values it
   sits between, and unlike a literal "|" it is not announced by a screen
   reader as "vertical bar". */
const Sep: React.FC = () => (
  <span
    aria-hidden="true"
    style={{ width: 1, height: 11, background: 'var(--line-sep)', margin: '0 12px', flexShrink: 0 }}
  />
);

/* Three ranked bars. The mark states what the tool is for — ordering entities
   by attention required — and the tallest bar carries the alert tone, which is
   the single thing the ranking exists to surface. */
const Emblem: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 32 32" role="img" aria-label="SAT-SA">
    <rect x="0.5" y="0.5" width="31" height="31" rx="5" fill="#ffffff" stroke="#cfd7e1" />
    <rect x="8" y="19" width="4" height="6" rx="1" fill="#2f66d8" />
    <rect x="14" y="14" width="4" height="11" rx="1" fill="#2f66d8" />
    <rect x="20" y="8" width="4" height="17" rx="1" fill="#c23d3d" />
  </svg>
);
