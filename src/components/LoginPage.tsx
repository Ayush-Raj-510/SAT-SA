import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  User,
  Mail,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  Building2,
  Clock,
  Info,
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import {
  authenticateUser,
  registerUser,
  getFailedAttempts,
  saveSession,
} from '../data/authUsers';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

type AuthMode = 'signin' | 'register';

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');

  // Sign-in state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Registration state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('Examiner');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Shared UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  // Failed-attempt lockout countdown
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  useEffect(() => {
    const status = getFailedAttempts();
    if (status.isLocked) setLockoutSeconds(status.remainingSeconds);
  }, []);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setErrorMsg(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockoutSeconds]);

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (lockoutSeconds > 0) {
      setErrorMsg(`Terminal locked for a further ${lockoutSeconds}s after repeated failures.`);
      return;
    }
    if (!loginIdentifier.trim()) {
      setErrorMsg('Enter your username, email address, or badge ID.');
      return;
    }
    if (!loginPassword.trim()) {
      setErrorMsg('Enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authenticateUser(loginIdentifier, loginPassword);
      if (!result.success || !result.user) {
        const status = getFailedAttempts();
        if (status.isLocked) setLockoutSeconds(status.remainingSeconds);
        setErrorMsg(result.error || 'Authentication failed.');
        setIsSubmitting(false);
        return;
      }

      saveSession(result.user, rememberMe);
      setSuccessMsg('Credentials verified. Opening supervisory session…');
      window.setTimeout(() => onLoginSuccess(result.user as UserProfile), 300);
    } catch {
      setErrorMsg('Authentication service error. Please retry.');
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!regName.trim()) {
      setErrorMsg('Enter your full name.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMsg('Enter a valid official email address.');
      return;
    }
    if (!regUsername.trim() || regUsername.length < 3) {
      setErrorMsg('Username must be at least 3 characters.');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('The two passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerUser({
        name: regName,
        username: regUsername,
        email: regEmail,
        password: regPassword,
        role: regRole,
      });

      if (!result.success || !result.user) {
        setErrorMsg(result.error || 'Registration failed.');
        setIsSubmitting(false);
        return;
      }

      saveSession(result.user, true);
      setSuccessMsg(`Account created for ${result.user.name} (${result.user.badge_id}).`);
      window.setTimeout(() => onLoginSuccess(result.user as UserProfile), 400);
    } catch {
      setErrorMsg('Failed to create the account. Please retry.');
      setIsSubmitting(false);
    }
  };

  const busy = isSubmitting || lockoutSeconds > 0;

  return (
    <div className="app-shell">
      {/* Classification banner */}
      <div
        className="login-classification"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '5px 12px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--line)',
          fontSize: 11,
          letterSpacing: '0.08em',
          fontWeight: 600,
          textTransform: 'uppercase',
          color: 'var(--fg-3)',
        }}
      >
        <Lock size={11} />
        Restricted — for authorised supervisory personnel only
      </div>

      <header
        className="login-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '12px 24px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg)',
        }}
      >
        <div className="row" style={{ gap: 10 }}>
          <Emblem />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>SAT-SA</div>
            <div className="text-xs dim">Supervisory Analytics Tool for SOC Assessment</div>
          </div>
        </div>
        <div className="row text-xs dim login-header-meta" style={{ gap: 14 }}>
          <span className="row" style={{ gap: 5 }}>
            <Building2 size={12} /> NTRO / NCIIPC
          </span>
          <span className="row" style={{ gap: 5 }}>
            <ShieldCheck size={12} /> Air-gapped enclave
          </span>
        </div>
      </header>

      <main className="app-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="login-layout">
          {/* Context column */}
          <section className="login-intro" style={{ alignSelf: 'center' }}>
            <span className="eyebrow">Supervisory access gateway</span>
            <h1
              style={{
                margin: '0 0 10px',
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: '-0.015em',
                lineHeight: 1.25,
              }}
            >
              Periodic SOC submission examination
            </h1>
            <p className="text-sm muted" style={{ margin: '0 0 20px', maxWidth: '52ch' }}>
              SAT-SA examines batch operational records submitted by Critical Sector Entities to
              identify execution gaps — nominal controls with superficial triage — and negative
              space, where expected evidence is absent altogether. All analysis runs locally and
              deterministically.
            </p>

            <div className="panel">
              <div className="panel-body panel-body-tight">
                <dl className="dl" style={{ margin: 0 }}>
                  {[
                    ['Analysis location', 'On-host only'],
                    ['Outbound network calls', 'None'],
                    ['Dataset integrity', 'SHA-256 per run'],
                    ['Decision authority', 'Human examiner'],
                  ].map(([k, v]) => (
                    <div className="dl-row" key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </section>

          {/* Credential column */}
          <section style={{ maxWidth: 460, width: '100%' }}>
            <div className="panel">
              <div className="panel-body">
                <div className="seg" style={{ display: 'flex', marginBottom: 18 }} role="tablist">
                  {(['signin', 'register'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="tab"
                      aria-selected={authMode === mode}
                      data-active={authMode === mode}
                      className="seg-item"
                      style={{ flex: 1 }}
                      onClick={() => switchMode(mode)}
                    >
                      {mode === 'signin' ? 'Sign in' : 'Register'}
                    </button>
                  ))}
                </div>

                {errorMsg && (
                  <div className="callout callout-danger" style={{ marginBottom: 14 }} role="alert">
                    <AlertCircle size={15} />
                    <div>{errorMsg}</div>
                  </div>
                )}
                {successMsg && (
                  <div className="callout callout-ok" style={{ marginBottom: 14 }} role="status">
                    <CheckCircle2 size={15} />
                    <div>{successMsg}</div>
                  </div>
                )}
                {lockoutSeconds > 0 && (
                  <div className="callout callout-warn" style={{ marginBottom: 14 }} role="status">
                    <Clock size={15} />
                    <div>
                      Too many failed attempts. Retry in <strong>{lockoutSeconds}s</strong>.
                    </div>
                  </div>
                )}

                {authMode === 'signin' ? (
                  <form onSubmit={handleSignIn} noValidate>
                    <div className="stack-12">
                      <div className="field">
                        <label className="label" htmlFor="login-identifier">
                          Username, email, or badge ID
                        </label>
                        <div className="field-icon">
                          <User />
                          <input
                            id="login-identifier"
                            name="identifier"
                            className="input"
                            type="text"
                            value={loginIdentifier}
                            onChange={(e) => setLoginIdentifier(e.target.value)}
                            placeholder="e.g. examiner"
                            autoComplete="username"
                            autoFocus
                            disabled={busy}
                          />
                        </div>
                      </div>

                      <div className="field">
                        <label className="label" htmlFor="login-password">
                          Password
                        </label>
                        <div className="field-icon">
                          <Lock />
                          <input
                            id="login-password"
                            name="password"
                            className="input"
                            type={showLoginPassword ? 'text' : 'password'}
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="Enter password"
                            autoComplete="current-password"
                            disabled={busy}
                            style={{ paddingRight: 32 }}
                          />
                          <button
                            type="button"
                            className="field-affix"
                            onClick={() => setShowLoginPassword((v) => !v)}
                            aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                          >
                            {showLoginPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>

                      <label className="row text-xs muted" style={{ gap: 7, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          name="remember-session"
                          className="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        Keep this session open for 24 hours
                      </label>

                      <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%', height: 34 }}>
                        <KeyRound size={14} />
                        {isSubmitting ? 'Verifying…' : 'Sign in'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleRegister} noValidate>
                    <div className="stack-12">
                      <div className="field">
                        <label className="label" htmlFor="reg-name">Full name</label>
                        <input
                          id="reg-name"
                          name="fullname"
                          className="input"
                          type="text"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="e.g. A. Deshmukh"
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="field">
                        <label className="label" htmlFor="reg-username">Username</label>
                        <input
                          id="reg-username"
                          name="username"
                          className="input"
                          type="text"
                          autoComplete="off"
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value)}
                          placeholder="letters, digits, . _ -"
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="field">
                        <label className="label" htmlFor="reg-email">Official email</label>
                        <div className="field-icon">
                          <Mail />
                          <input
                            id="reg-email"
                            name="email"
                            className="input"
                            type="email"
                            autoComplete="off"
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            placeholder="name@organisation.gov.in"
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>

                      <div className="field">
                        <label className="label" htmlFor="reg-role">Jurisdictional role</label>
                        <select
                          id="reg-role"
                          name="role"
                          className="select"
                          value={regRole}
                          onChange={(e) => setRegRole(e.target.value as UserRole)}
                          disabled={isSubmitting}
                        >
                          <option value="Examiner">Senior supervisory examiner</option>
                          <option value="Administrator">Enclave administrator</option>
                          <option value="Read-only Reviewer">Statutory compliance auditor</option>
                        </select>
                      </div>

                      <div className="field">
                        <label className="label" htmlFor="reg-password">Password</label>
                        <div className="field-icon">
                          <input
                            id="reg-password"
                            name="new-password"
                            className="input"
                            autoComplete="new-password"
                            type={showRegPassword ? 'text' : 'password'}
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="Minimum 6 characters"
                            disabled={isSubmitting}
                            style={{ paddingRight: 32 }}
                          />
                          <button
                            type="button"
                            className="field-affix"
                            onClick={() => setShowRegPassword((v) => !v)}
                            aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                          >
                            {showRegPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>

                      <div className="field">
                        <label className="label" htmlFor="reg-confirm">Confirm password</label>
                        <input
                          id="reg-confirm"
                          name="confirm-password"
                          className="input"
                          autoComplete="new-password"
                          type={showRegPassword ? 'text' : 'password'}
                          value={regConfirmPassword}
                          onChange={(e) => setRegConfirmPassword(e.target.value)}
                          placeholder="Repeat password"
                          disabled={isSubmitting}
                          aria-invalid={Boolean(regConfirmPassword) && regConfirmPassword !== regPassword}
                          style={
                            regConfirmPassword && regConfirmPassword !== regPassword
                              ? { borderColor: 'var(--danger)' }
                              : undefined
                          }
                        />
                        {regConfirmPassword && regConfirmPassword !== regPassword && (
                          <div className="hint" style={{ color: 'var(--danger)' }}>Passwords do not match.</div>
                        )}
                      </div>

                      <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ width: '100%', height: 34 }}>
                        <ShieldCheck size={14} />
                        {isSubmitting ? 'Creating account…' : 'Create account and enter'}
                      </button>
                    </div>
                  </form>
                )}

                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 14,
                    borderTop: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <span className="row text-xs dim" style={{ gap: 5 }}>
                    <Lock size={11} /> bcrypt / salted SHA-256 verification
                  </span>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => setShowDemoAccounts((v) => !v)}
                    aria-expanded={showDemoAccounts}
                  >
                    <Info size={12} /> {showDemoAccounts ? 'Hide' : 'Demo'} accounts
                  </button>
                </div>

                {showDemoAccounts && (
                  <div className="inset" style={{ marginTop: 10, padding: 10 }}>
                    <div className="text-xs dim" style={{ marginBottom: 7 }}>
                      Seeded evaluation accounts for this air-gapped build. Replace before operational use.
                    </div>
                    <table className="tbl" style={{ fontSize: 11.5 }}>
                      <thead>
                        <tr>
                          <th>Role</th>
                          <th>Username</th>
                          <th>Password</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['Administrator', 'admin', 'admin123'],
                          ['Examiner', 'examiner', 'examiner123'],
                          ['Read-only Reviewer', 'auditor', 'auditor123'],
                        ].map(([role, user, pass]) => (
                          <tr key={user}>
                            <td className="cell-strong">{role}</td>
                            <td className="mono">{user}</td>
                            <td className="mono">{pass}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer
        style={{
          borderTop: '1px solid var(--line)',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          fontSize: 11.5,
          color: 'var(--fg-3)',
        }}
      >
        <span>Government of India — critical information infrastructure protection</span>
        <span className="mono">SAT-SA 2026.09-AIRGAP</span>
      </footer>
    </div>
  );
};

/* Product emblem. A plain geometric mark reads as institutional; an emoji or a
   glowing triangle does not. */
const Emblem: React.FC<{ size?: number }> = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="SAT-SA">
    <rect x="0.5" y="0.5" width="31" height="31" rx="5" fill="#ffffff" stroke="#cfd7e1" />
    <rect x="8" y="19" width="4" height="6" rx="1" fill="#2f66d8" />
    <rect x="14" y="14" width="4" height="11" rx="1" fill="#2f66d8" />
    <rect x="20" y="8" width="4" height="17" rx="1" fill="#c23d3d" />
  </svg>
);
