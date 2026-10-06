const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const TOKEN_KEY = 'lpams_admin_token';
const ADMIN_KEY = 'lpams_admin_info';
const AUTH_NOTICE_KEY = 'lpams_auth_notice';

// localStorage is shared by every tab of this browser, so one browser = one
// signed-in account. Opening a new tab reuses the same login.
export function saveSession(token, admin) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAdmin() {
  const raw = localStorage.getItem(ADMIN_KEY);
  return raw ? JSON.parse(raw) : null;
}

// Changes some saved fields of the signed-in admin (e.g. after changing the password).
export function updateAdmin(patch) {
  const admin = getAdmin();
  if (admin) localStorage.setItem(ADMIN_KEY, JSON.stringify({ ...admin, ...patch }));
}

export function isSuperAdmin() {
  const admin = getAdmin();
  return admin?.role === 'super_admin';
}

export function isLoggedIn() {
  return !!getToken();
}

// Ends a session on the server without touching this browser's saved login.
// Used when a token must be thrown away (e.g. a second account signed in
// from another tab of the same browser).
export function revokeToken(token) {
  if (!token) return;
  fetch(`${API_URL}/api/admin/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    keepalive: true,
  }).catch(() => {});
}

export function logout(notice) {
  // Tell the server to end THIS browser's session (other browsers stay signed in).
  // If the session is already gone server-side, this just fails quietly.
  revokeToken(getToken());

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
  if (notice) {
    localStorage.setItem(AUTH_NOTICE_KEY, notice);
  }
}

export function consumeAuthNotice() {
  const notice = localStorage.getItem(AUTH_NOTICE_KEY);
  if (notice) localStorage.removeItem(AUTH_NOTICE_KEY);
  return notice;
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
      if (body.message?.toLowerCase().includes('session') || body.message?.toLowerCase().includes('log in')) {
        logout(body.message);
        window.location.href = '/login';
      }
    } catch {
      // response wasn't JSON, ignore
    }
  }

  return res;
}

// "Chrome on Windows"-style label for the approval prompt.
export function describeUserAgent(ua = '') {
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' : 'A browser';
  const os =
    /Windows/.test(ua) ? 'Windows' :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad/.test(ua) ? 'iOS' :
    /Mac OS X/.test(ua) ? 'macOS' :
    /Linux/.test(ua) ? 'Linux' : 'an unknown device';
  return `${browser} on ${os}`;
}