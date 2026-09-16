const TOKEN_KEY = 'lpams_admin_token';
const ADMIN_KEY = 'lpams_admin_info';
const ACTIVE_LOCK_KEY = 'lpams_active_admin';
const LOCK_LIFETIME_MS = 8 * 60 * 60 * 1000; // 8 hours
const AUTH_NOTICE_KEY = 'lpams_auth_notice';

export function saveSession(token, admin) {
  // 1. Save the actual auth token in sessionStorage 
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  
  // 2. Save the browser lock in localStorage (so other tabs are blocked)
  localStorage.setItem(
    ACTIVE_LOCK_KEY,
    JSON.stringify({
      admin_id: admin.admin_id,
      role: admin.role,
      name: admin.name,
      expiresAt: Date.now() + LOCK_LIFETIME_MS,
    })
  );
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getAdmin() {
  const raw = sessionStorage.getItem(ADMIN_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function isSuperAdmin() {
  const admin = getAdmin();
  return admin?.role === 'super_admin';
}

export function isLoggedIn() {
  return !!getToken();
}

export function getActiveLock() {
  const raw = localStorage.getItem(ACTIVE_LOCK_KEY);
  if (!raw) return null;

  const lock = JSON.parse(raw);
  if (lock.expiresAt && Date.now() > lock.expiresAt) {
    localStorage.removeItem(ACTIVE_LOCK_KEY);
    return null;
  }
  return lock;
}

export function isBrowserLockedByOther() {
  return !!getActiveLock();
}

export function logout(notice) {
  // Clear everything from both storages
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_KEY);
  localStorage.removeItem(ACTIVE_LOCK_KEY);
  if (notice) {
    sessionStorage.setItem(AUTH_NOTICE_KEY, notice);
  }
}

export function consumeAuthNotice() {
  const notice = sessionStorage.getItem(AUTH_NOTICE_KEY);
  if (notice) sessionStorage.removeItem(AUTH_NOTICE_KEY);
  return notice;
}

export { ACTIVE_LOCK_KEY };

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    const myAdmin = getAdmin();
    const lock = getActiveLock();
    if (myAdmin && lock && lock.admin_id === myAdmin.admin_id) {
      localStorage.removeItem(ACTIVE_LOCK_KEY);
    }
  });
}

export async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    const cloned = res.clone();
    try {
      const body = await cloned.json();
      if (body.message?.toLowerCase().includes('token') || body.message?.toLowerCase().includes('log in')) {
        logout(body.message);
        window.location.href = '/login';
      }
    } catch {
      // response wasn't JSON, ignore
    }
  }

  return res;
}