const TOKEN_KEY = 'lpams_admin_token';
const ADMIN_KEY = 'lpams_admin_info';
const AUTH_NOTICE_KEY = 'lpams_auth_notice';

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

export function isSuperAdmin() {
  const admin = getAdmin();
  return admin?.role === 'super_admin';
}

export function isLoggedIn() {
  return !!getToken();
}

export function logout(notice) {
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