const TOKEN_KEY = 'lpams_admin_token';
const ADMIN_KEY = 'lpams_admin_info';

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

export function logout() {
     localStorage.removeItem(TOKEN_KEY);
     localStorage.removeItem(ADMIN_KEY);
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

     // Token expired or invalid — clear session so ProtectedRoute redirects to login
     if (res.status === 401 || res.status === 403) {
     const cloned = res.clone();
     try {
          const body = await cloned.json();
          if (body.message?.toLowerCase().includes('token') || body.message?.toLowerCase().includes('log in')) {
          logout();
          }
     } catch {
          // response wasn't JSON, ignore
     }
     }

  return res;
}