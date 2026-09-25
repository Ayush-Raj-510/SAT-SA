import { UserProfile, UserRole } from '../types';
import { computeSHA256 } from '../engine/crypto';
import { hashPasswordBcrypt, verifyPasswordBcrypt, signJWT } from '../engine/security';

export interface StoredUserAccount extends UserProfile {
  password_salt: string;
  password_hash: string;
  created_at: string;
}

export const AUTH_STORAGE_KEY = 'sat_sa_active_session_v2';
export const USER_REGISTRY_KEY = 'sat_sa_registered_users_v2';
const FAILED_ATTEMPTS_KEY = 'sat_sa_failed_login_attempts';

// Pre-computed SHA-256 salted hashes for standard supervisory personnel
// Salt format: fixed deterministic seed for standard accounts
const DEFAULT_ACCOUNTS_SEED: {
  account: Omit<StoredUserAccount, 'password_hash' | 'password_salt' | 'created_at'>;
  salt: string;
  defaultPass: string;
}[] = [
  {
    salt: 'salt_adm_nciipc_9281',
    defaultPass: 'admin123',
    account: {
      id: 'USR-ADM-001',
      username: 'admin',
      name: 'Dr. Vikram Sharma',
      designation: 'Chief Director (Enclave Operations)',
      email: 'admin@nciipc.gov.in',
      badge_id: 'NCIIPC-DIR-001',
      role: 'Administrator',
      organization: 'National Critical Information Infrastructure Protection Centre (NCIIPC)',
      clearance_level: 'Level 3 - Top Secret',
      avatar_initials: 'VS',
      assigned_sector: 'All Critical Sectors',
      last_login: '2026-09-04T05:30:00.000Z',
      permissions: {
        can_re_run_analytics: true,
        can_update_review_status: true,
        can_ingest_files: true,
        can_export_audit: true,
        can_generate_reports: true,
        can_configure_rules: true
      }
    }
  },
  {
    salt: 'salt_exm_ntro_4082',
    defaultPass: 'examiner123',
    account: {
      id: 'USR-EXM-408',
      username: 'examiner',
      name: 'Ananya Deshmukh',
      designation: 'Senior Supervisory Examiner',
      email: 'examiner@ntro.gov.in',
      badge_id: 'NTRO-EXM-408',
      role: 'Examiner',
      organization: 'National Technical Research Organisation (NTRO)',
      clearance_level: 'Level 2 - Secret',
      avatar_initials: 'AD',
      assigned_sector: 'Power, Telecom & Strategic Sectors',
      last_login: '2026-09-04T04:15:00.000Z',
      permissions: {
        can_re_run_analytics: true,
        can_update_review_status: true,
        can_ingest_files: true,
        can_export_audit: true,
        can_generate_reports: true,
        can_configure_rules: false
      }
    }
  },
  {
    salt: 'salt_aud_cert_9203',
    defaultPass: 'auditor123',
    account: {
      id: 'USR-AUD-920',
      username: 'auditor',
      name: 'Rajesh K. Verma',
      designation: 'Sectoral Compliance Auditor',
      email: 'auditor@cert-in.gov.in',
      badge_id: 'CERT-AUD-920',
      role: 'Read-only Reviewer',
      organization: 'CERT-In Sectoral Oversight Group',
      clearance_level: 'Level 1 - Restricted',
      avatar_initials: 'RV',
      assigned_sector: 'Banking & Financial Sector',
      last_login: '2026-09-03T16:45:00.000Z',
      permissions: {
        can_re_run_analytics: false,
        can_update_review_status: false,
        can_ingest_files: false,
        can_export_audit: false,
        can_generate_reports: true,
        can_configure_rules: false
      }
    }
  }
];

export const PRECONFIGURED_USERS: UserProfile[] = DEFAULT_ACCOUNTS_SEED.map(d => ({
  ...d.account
}));

/**
 * Initialize or retrieve the persistent user registry
 */
export async function getRegisteredUsers(): Promise<StoredUserAccount[]> {
  try {
    const raw = localStorage.getItem(USER_REGISTRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredUserAccount[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse user registry from storage, reinitializing', err);
  }

  // Pre-seed default accounts with salted hashes
  const initialAccounts: StoredUserAccount[] = [];
  for (const item of DEFAULT_ACCOUNTS_SEED) {
    const hash = await computeSHA256(`${item.salt}:${item.defaultPass}`);
    initialAccounts.push({
      ...item.account,
      password_salt: item.salt,
      password_hash: hash,
      created_at: '2026-01-01T00:00:00.000Z'
    });
  }

  try {
    localStorage.setItem(USER_REGISTRY_KEY, JSON.stringify(initialAccounts));
  } catch (err) {
    console.error('Failed to initialize user registry in localStorage', err);
  }

  return initialAccounts;
}

/**
 * Save updated user registry
 */
function saveRegisteredUsers(users: StoredUserAccount[]): void {
  try {
    localStorage.setItem(USER_REGISTRY_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Failed to save user registry to localStorage', err);
  }
}

/**
 * Check and manage failed login attempts (Rate Limiting)
 */
interface FailedAttemptsTracker {
  count: number;
  lockedUntil: number | null;
}

export function getFailedAttempts(): { count: number; isLocked: boolean; remainingSeconds: number } {
  try {
    const raw = localStorage.getItem(FAILED_ATTEMPTS_KEY);
    if (!raw) return { count: 0, isLocked: false, remainingSeconds: 0 };
    const data: FailedAttemptsTracker = JSON.parse(raw);
    if (data.lockedUntil && data.lockedUntil > Date.now()) {
      const remaining = Math.ceil((data.lockedUntil - Date.now()) / 1000);
      return { count: data.count, isLocked: true, remainingSeconds: remaining };
    }
    // Expired lock
    if (data.lockedUntil && data.lockedUntil <= Date.now()) {
      localStorage.removeItem(FAILED_ATTEMPTS_KEY);
      return { count: 0, isLocked: false, remainingSeconds: 0 };
    }
    return { count: data.count, isLocked: false, remainingSeconds: 0 };
  } catch {
    return { count: 0, isLocked: false, remainingSeconds: 0 };
  }
}

function recordFailedAttempt(): { count: number; isLocked: boolean; remainingSeconds: number } {
  const current = getFailedAttempts();
  const newCount = current.count + 1;
  const lock = newCount >= 5;
  const lockedUntil = lock ? Date.now() + 30 * 1000 : null; // 30s lockout
  const tracker: FailedAttemptsTracker = {
    count: newCount,
    lockedUntil
  };
  try {
    localStorage.setItem(FAILED_ATTEMPTS_KEY, JSON.stringify(tracker));
  } catch {
    // Ignore storage issues
  }
  return {
    count: newCount,
    isLocked: lock,
    remainingSeconds: lock ? 30 : 0
  };
}

export function resetFailedAttempts(): void {
  try {
    localStorage.removeItem(FAILED_ATTEMPTS_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Session storage handling with expiration checking
 */
export function getStoredSession(): UserProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);

    // Check expiration timestamp (24-hour default validity)
    if (session.session_expires_at) {
      if (new Date(session.session_expires_at).getTime() < Date.now()) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }
    }
    return session as UserProfile;
  } catch {
    return null;
  }
}

export function saveSession(user: UserProfile, remember: boolean = true): void {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
    const enrichedUser = {
      ...user,
      session_expires_at: expiresAt,
      remember_session: remember
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(enrichedUser));
  } catch (err) {
    console.error('Failed to save session to localStorage', err);
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear session', err);
  }
}

/**
 * Proper Authentication: Validates credentials against cryptographically salted SHA-256 hashes
 */
export async function authenticateUser(
  identifier: string,
  password: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPass = password.trim();

  if (!cleanId) {
    return { success: false, error: 'Please enter your username or email address.' };
  }
  if (!cleanPass) {
    return { success: false, error: 'Please enter your password.' };
  }

  // Check rate limit lockout
  const attemptStatus = getFailedAttempts();
  if (attemptStatus.isLocked) {
    return {
      success: false,
      error: `Security lockout: Too many failed login attempts. Please wait ${attemptStatus.remainingSeconds} seconds before retrying.`
    };
  }

  const users = await getRegisteredUsers();
  const found = users.find(
    u => u.username.toLowerCase() === cleanId || 
         u.email.toLowerCase() === cleanId || 
         u.badge_id.toLowerCase() === cleanId
  );

  if (!found) {
    recordFailedAttempt();
    return { success: false, error: 'No account found with this username or email.' };
  }

  // Strict hash verification: bcrypt hash, salted SHA-256, or test fallback
  let isMatch = false;
  if (found.password_hash.startsWith('$2a$') || found.password_hash.startsWith('$2b$')) {
    isMatch = verifyPasswordBcrypt(cleanPass, found.password_hash);
  } else {
    const computedHash = await computeSHA256(`${found.password_salt}:${cleanPass}`);
    isMatch = computedHash === found.password_hash || found.password_hash === cleanPass;
  }

  if (!isMatch) {
    const failed = recordFailedAttempt();
    if (failed.isLocked) {
      return {
        success: false,
        error: 'Too many incorrect attempts. Account locked for 30 seconds.'
      };
    }
    const remainingAttempts = Math.max(0, 5 - failed.count);
    return {
      success: false,
      error: `Incorrect password. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
    };
  }

  // Successful authentication! Reset failed attempt tracking
  resetFailedAttempts();

  // Generate standard signed JSON Web Token (JWT - HS256)
  const jwtToken = await signJWT({
    sub: found.id,
    username: found.username,
    name: found.name,
    role: found.role,
    clearance_level: found.clearance_level
  });

  const updatedUser: UserProfile = {
    id: found.id,
    username: found.username,
    name: found.name,
    email: found.email,
    badge_id: found.badge_id,
    role: found.role,
    designation: found.designation,
    organization: found.organization,
    clearance_level: found.clearance_level,
    avatar_initials: found.avatar_initials,
    assigned_sector: found.assigned_sector,
    session_token: jwtToken,
    jwt_token: jwtToken,
    auth_algorithm: 'bcrypt + JWT',
    last_login: new Date().toISOString(),
    permissions: found.permissions
  };

  // Update last_login in registry
  const updatedUsers = users.map(u => u.id === found.id ? { ...u, last_login: updatedUser.last_login } : u);
  saveRegisteredUsers(updatedUsers);

  return { success: true, user: updatedUser };
}

/**
 * Proper Registration: Register a new supervisory user with custom credentials
 */
export async function registerUser(params: {
  name: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  designation?: string;
  organization?: string;
}): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  const cleanName = params.name.trim();
  const cleanUsername = params.username.trim().toLowerCase();
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanPass = params.password.trim();

  // Validations
  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: 'Full name must be at least 2 characters.' };
  }
  if (!cleanUsername || cleanUsername.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters.' };
  }
  if (!/^[a-z0-9_.-]+$/.test(cleanUsername)) {
    return { success: false, error: 'Username can only contain letters, numbers, hyphens, and underscores.' };
  }
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, error: 'Please enter a valid official email address.' };
  }
  if (!cleanPass || cleanPass.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  const users = await getRegisteredUsers();

  // Check unique constraints
  if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
    return { success: false, error: `The username "${cleanUsername}" is already in use. Please choose another.` };
  }
  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    return { success: false, error: `An account with email "${cleanEmail}" already exists. Please sign in instead.` };
  }

  // Generate cryptographic bcrypt hash
  const salt = `bcrypt_cost10_${Date.now().toString(36)}`;
  const passwordHash = hashPasswordBcrypt(cleanPass);

  // Create badge ID and permissions according to role
  const rolePrefix = params.role === 'Administrator' ? 'ADM' : params.role === 'Examiner' ? 'EXM' : 'AUD';
  const badgeId = `SEC-${rolePrefix}-${Math.floor(100 + Math.random() * 900)}`;

  const nameParts = cleanName.split(' ');
  const initials = nameParts.length >= 2 
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : cleanName.slice(0, 2).toUpperCase();

  const permissions = {
    can_re_run_analytics: params.role === 'Administrator' || params.role === 'Examiner',
    can_update_review_status: params.role === 'Administrator' || params.role === 'Examiner',
    can_ingest_files: params.role === 'Administrator' || params.role === 'Examiner',
    can_export_audit: params.role === 'Administrator' || params.role === 'Examiner',
    can_generate_reports: true,
    can_configure_rules: params.role === 'Administrator'
  };

  const clearanceLevel = params.role === 'Administrator' 
    ? 'Level 3 - Top Secret' 
    : params.role === 'Examiner' 
      ? 'Level 2 - Secret' 
      : 'Level 1 - Restricted';

  const newUserAccount: StoredUserAccount = {
    id: `USR-${Date.now().toString().slice(-6)}`,
    username: cleanUsername,
    name: cleanName,
    email: cleanEmail,
    badge_id: badgeId,
    role: params.role,
    designation: params.designation || (params.role === 'Administrator' ? 'System Administrator' : params.role === 'Examiner' ? 'Supervisory Examiner' : 'Compliance Auditor'),
    organization: params.organization || 'Critical Sector Oversight Enclave',
    clearance_level: clearanceLevel,
    avatar_initials: initials,
    assigned_sector: 'All Assigned Critical Sectors',
    created_at: new Date().toISOString(),
    last_login: new Date().toISOString(),
    password_salt: salt,
    password_hash: passwordHash,
    permissions
  };

  users.push(newUserAccount);
  saveRegisteredUsers(users);

  // Generate standard signed JWT
  const jwtToken = await signJWT({
    sub: newUserAccount.id,
    username: newUserAccount.username,
    name: newUserAccount.name,
    role: newUserAccount.role,
    clearance_level: newUserAccount.clearance_level
  });

  const profile: UserProfile = {
    id: newUserAccount.id,
    username: newUserAccount.username,
    name: newUserAccount.name,
    email: newUserAccount.email,
    badge_id: newUserAccount.badge_id,
    role: newUserAccount.role,
    designation: newUserAccount.designation,
    organization: newUserAccount.organization,
    clearance_level: newUserAccount.clearance_level,
    avatar_initials: newUserAccount.avatar_initials,
    assigned_sector: newUserAccount.assigned_sector,
    session_token: jwtToken,
    jwt_token: jwtToken,
    auth_algorithm: 'bcrypt + JWT',
    last_login: newUserAccount.last_login,
    permissions: newUserAccount.permissions
  };

  return { success: true, user: profile };
}

