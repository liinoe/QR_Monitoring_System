const TOKEN_KEY = 'lpams_admin_token';
const ADMIN_KEY = 'lpams_admin_info';

// Browser-wide lock (localStorage, NOT sessionStorage — this is the one
// piece of state that must be visible across tabs). Holds only low-
// sensitivity identity info (admin_id/role/name) plus an expiry, never
// the token itself, so the actual session credential still only ever
// lives in the owning tab's sessionStorage.
//
// The expiry matters: unlike sessionStorage, localStorage does NOT clear
// itself when a tab/browser closes — it just sits there until something
// explicitly removes it. Without an expiry, closing the browser without
// clicking Logout would leave this lock stuck forever, permanently
// blocking every future login in that browser. Capping it at the same
// lifetime as the JWT itself (8h) means an abandoned lock can never
// outlive the actual session it represents.
const ACTIVE_LOCK_KEY = 'lpams_active_admin';
const LOCK_LIFETIME_MS = 8 * 60 * 60 * 1000; // must match the backend's JWT expiresIn: '8h'

// One-shot message left behind when a session is force-logged-out
// (superseded elsewhere, or expired) so the Login screen can explain WHY
// instead of the person just silently landing back on a blank form.
const AUTH_NOTICE_KEY = 'lpams_auth_notice';

export function saveSession(token, admin) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
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

// Reads the browser-wide lock. Returns null if no admin is currently
// active anywhere in this browser — including when a lock exists but has
// expired, in which case it's cleaned up right here so nobody ever needs
// to manually clear it via DevTools again.
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

// Proactive cleanup: when THIS tab is the one that owns the active lock
// and it's being closed/navigated away from normally (tab close, browser
// close, closing the laptop, etc.), release the lock immediately instead
// of waiting for it to expire on its own. `pagehide` is used over the
// older `beforeunload`/`unload` because it fires more reliably across
// modern browsers for this kind of synchronous cleanup.
//
// Only clears the lock if it currently belongs to THIS tab's own admin —
// a tab that's just sitting on the blocked Login screen (not logged in
// itself) must never be able to wipe out someone else's real active lock
// simply by being closed.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    const myAdmin = getAdmin();
    const lock = getActiveLock();
    if (myAdmin && lock && lock.admin_id === myAdmin.admin_id) {
      localStorage.removeItem(ACTIVE_LOCK_KEY);
    }
  });
}

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