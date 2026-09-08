const TOKEN_KEY = 'lpams_admin_token';
const ADMIN_KEY = 'lpams_admin_info';

// Holds only low-
// sensitivity identity info (admin_id/role/name), never the token itself,
// so the actual session credential still only ever lives in the owning
// tab's sessionStorage. Its presence means "some tab in this browser
// currently holds a real session" — used to block a second login
// anywhere else in the browser, and to let other tabs detect and react
// when a new login supersedes them.
const ACTIVE_LOCK_KEY = 'lpams_active_admin';

// One-shot message left behind when a session is force-logged-out
// (superseded elsewhere, or expired) so the Login screen can explain WHY
// instead of the person just silently landing back on a blank form.
const AUTH_NOTICE_KEY = 'lpams_auth_notice';

export function saveSession(token, admin) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  localStorage.setItem(
    ACTIVE_LOCK_KEY,
    JSON.stringify({ admin_id: admin.admin_id, role: admin.role, name: admin.name })
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

// Reads the browser-wide lock. Returns null if no admin is currently
// active anywhere in this browser.
export function getActiveLock() {
  const raw = localStorage.getItem(ACTIVE_LOCK_KEY);
  return raw ? JSON.parse(raw) : null;
}

// True when some OTHER identity already holds the browser lock — i.e. a
// login attempt right now should be blocked. Only meaningful when called
// from a tab that isn't itself already logged in (Login.jsx already
// redirects away if isLoggedIn() is true, so that's guaranteed there).
export function isBrowserLockedByOther() {
  return !!getActiveLock();
}

export function logout(notice) {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_KEY);
  localStorage.removeItem(ACTIVE_LOCK_KEY);
  if (notice) {
    sessionStorage.setItem(AUTH_NOTICE_KEY, notice);
  }
}

// Consumed once by Login.jsx on mount — reads and clears in one step so
// the message doesn't linger and reappear on a later, unrelated visit.
export function consumeAuthNotice() {
  const notice = sessionStorage.getItem(AUTH_NOTICE_KEY);
  if (notice) sessionStorage.removeItem(AUTH_NOTICE_KEY);
  return notice;
}

// Exported so ProtectedRoute can listen for changes to exactly this key
// without duplicating the string.
export { ACTIVE_LOCK_KEY };

// Wraps fetch to attach the Authorization header automatically.
// Usage: authFetch(`${API_URL}/api/admin/pending`)
export async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, { ...options, headers });

  // Token expired, invalid, or superseded by another session — force an
  // immediate, clean redirect rather than just clearing storage and
  // leaving the current page to quietly render broken/empty state until
  // the person happens to refresh.
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