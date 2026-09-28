import { useEffect } from "react";
import { TOKEN_KEY } from "../auth";

// Keeps every tab of this browser on the same account.
//   - Signed out in one tab  → other tabs go to the login page.
//   - Signed in in one tab   → a tab sitting on the login page goes to the dashboard.
// The "storage" event only fires in the OTHER tabs, never the one that made the change.
// Kiosk / public pages don't depend on the admin login, so leave them alone.
const PUBLIC_PATHS = ["/scanner", "/guest", "/guest-landing", "/guest-logout", "/bootstrap"];

const SessionSync = () => {
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== TOKEN_KEY && e.key !== null) return; // null = storage cleared
      if (PUBLIC_PATHS.includes(window.location.pathname)) return;
      const signedIn = !!localStorage.getItem(TOKEN_KEY);
      const onLoginPage = window.location.pathname === "/login";

      if (!signedIn && !onLoginPage) window.location.href = "/login";
      else if (signedIn && onLoginPage) window.location.href = "/";
      else if (signedIn) window.location.reload(); // account changed underneath this tab
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
};

export default SessionSync;