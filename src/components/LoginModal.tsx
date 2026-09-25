import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import { UserProfile } from '../types';
import { authenticateUser } from '../data/authUsers';
import { Modal, Panel, Badge } from './ui';

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: UserProfile) => void;
  onClose?: () => void;
  isModal?: boolean;
  currentUser?: UserProfile | null;
}

const RBAC_MATRIX: { capability: string; admin: boolean; examiner: boolean; auditor: boolean }[] = [
  { capability: 'View dashboards, rankings and findings', admin: true, examiner: true, auditor: true },
  { capability: 'Record examiner determinations', admin: true, examiner: true, auditor: false },
  { capability: 'Ingest periodic submission files', admin: true, examiner: true, auditor: false },
  { capability: 'Re-run the deterministic analytics', admin: true, examiner: true, auditor: false },
  { capability: 'Generate the supervisory report', admin: true, examiner: true, auditor: true },
  { capability: 'Export the run manifest and audit trail', admin: true, examiner: true, auditor: false },
  { capability: 'Modify detector rules and thresholds', admin: true, examiner: false, auditor: false },
];

const Grant: React.FC<{ granted: boolean }> = ({ granted }) => (
  <span style={{ color: granted ? 'var(--ok)' : 'var(--fg-3)', fontSize: 11.5 }}>
    {granted ? 'Granted' : 'Restricted'}
  </span>
);

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onLoginSuccess,
  onClose,
  isModal = true,
  currentUser,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim() || !password.trim()) {
      setErrorMsg('Enter both an identifier and a password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authenticateUser(identifier, password);
      if (!res.success || !res.user) {
        setErrorMsg(res.error || 'Credentials rejected, or the badge ID is not authorised.');
        setIsSubmitting(false);
        return;
      }
      onLoginSuccess(res.user);
      setIsSubmitting(false);
      onClose?.();
    } catch {
      setErrorMsg('Authentication error. Please retry.');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Switch supervisory account"
      subtitle="Re-authenticate to change role. The active session is replaced."
      onClose={onClose ?? (() => undefined)}
      width={720}
      footer={
        <span className="row" style={{ gap: 6 }}>
          <Lock size={12} /> Air-gapped terminal · bcrypt and salted SHA-256 verification
        </span>
      }
    >
      <div className="stack">
        {currentUser && (
          <div className="inset row-between" style={{ padding: '10px 12px' }}>
            <span className="text-xs muted">
              Currently signed in as <strong style={{ color: 'var(--fg)' }}>{currentUser.name}</strong>
            </span>
            <Badge tone="accent">{currentUser.role}</Badge>
          </div>
        )}

        {errorMsg && (
          <div className="callout callout-danger" role="alert">
            <AlertCircle size={15} />
            <div>{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid-half">
            <div className="field">
              <label className="label" htmlFor="switch-identifier">Identifier</label>
              <input
                id="switch-identifier"
                name="identifier"
                className="input"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="username, email, or badge ID"
                autoComplete="username"
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="switch-password">Password</label>
              <div className="field-icon">
                <Lock />
                <input
                  id="switch-password"
                  name="password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  style={{ paddingRight: 32 }}
                />
                <button
                  type="button"
                  className="field-affix"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div className="row-between" style={{ marginTop: 12 }}>
            <span className="text-xs dim">
              Seeded evaluation accounts: <span className="mono">admin / admin123</span>,{' '}
              <span className="mono">examiner / examiner123</span>,{' '}
              <span className="mono">auditor / auditor123</span>
            </span>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <KeyRound size={13} /> {isSubmitting ? 'Verifying…' : 'Sign in'}
            </button>
          </div>
        </form>

        <Panel title="Role-based access control" note="Applies to the active enclave build." bodyClassName="">
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th className="cell-center" style={{ width: 120 }}>Administrator</th>
                  <th className="cell-center" style={{ width: 110 }}>Examiner</th>
                  <th className="cell-center" style={{ width: 140 }}>Read-only reviewer</th>
                </tr>
              </thead>
              <tbody>
                {RBAC_MATRIX.map((row) => (
                  <tr key={row.capability}>
                    <td>{row.capability}</td>
                    <td className="cell-center"><Grant granted={row.admin} /></td>
                    <td className="cell-center"><Grant granted={row.examiner} /></td>
                    <td className="cell-center"><Grant granted={row.auditor} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </Modal>
  );
};
