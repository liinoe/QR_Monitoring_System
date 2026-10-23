import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { saveSession, isLoggedIn, consumeAuthNotice, getAdmin, revokeToken } from "../../auth";
import Header from "../../components/Header";
import { AuthInput } from "../../components/AuthInput";
import { btn } from "../../components/AdminUI";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const POLL_MS = 2000;

// Basic email shape: something@something.something (no spaces).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns the message to show under the Email box, or "" if the email looks fine.
const checkEmail = (value) => {
    const email = value.trim();
    if (!email) return "Please enter your email.";
    if (!EMAIL_REGEX.test(email)) return "Enter a valid email, e.g. name@cvsu.edu.ph";
    return "";
};

// Admin / staff sign-in page. Same deep green header as the admin pages and a
// white card with the app-style inputs. Also handles "waiting for approval" when
// the account is already open in another browser.
const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    // Show the email format message only after they leave the box or press Sign In,
    // so it doesn't nag while they're still typing.
    const [emailTouched, setEmailTouched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [checkingSetup, setCheckingSetup] = useState(true);

    // Sign-in approval: set while waiting for the already-signed-in browser to answer.
    const [pending, setPending] = useState(null); // { requestId, secondsLeft }
    const pollRef = useRef(null);
    const countdownRef = useRef(null);

    // On open: skip to the dashboard if already signed in, show any sign-out notice,
    // and go to first-time setup if no admin account exists yet.
    useEffect(() => {
        document.title = "Sign In · QLess";
        if (isLoggedIn()) {
            navigate("/", { replace: true });
            return;
        }

        const notice = consumeAuthNotice();
        if (notice) setError(notice);

        fetch(`${API_URL}/api/admin/check-setup`)
            .then((res) => res.json())
            .then((data) => {
                if (data.needsSetup) {
                    navigate("/bootstrap", { replace: true });
                } else {
                    setCheckingSetup(false);
                }
            })
            .catch(() => setCheckingSetup(false));
    }, [navigate]);

    // Stops the polling and countdown timers and leaves the waiting screen.
    const stopWaiting = () => {
        clearInterval(pollRef.current);
        clearInterval(countdownRef.current);
        pollRef.current = null;
        countdownRef.current = null;
        setPending(null);
    };

    // If the page is closed while waiting, withdraw the request so the other
    // browser's prompt disappears.
    useEffect(() => {
        const cancelOnLeave = () => {
            if (pending?.requestId) {
                navigator.sendBeacon?.(`${API_URL}/api/admin/login-requests/${pending.requestId}/cancel`);
            }
        };
        window.addEventListener("pagehide", cancelOnLeave);
        return () => window.removeEventListener("pagehide", cancelOnLeave);
    }, [pending?.requestId]);

    // Clears the timers if the page is left.
    useEffect(() => () => {
        clearInterval(pollRef.current);
        clearInterval(countdownRef.current);
    }, []);

    // One account per browser: if another tab signed in while this one was on
    // the login page, don't let a second account overwrite it.
    const finishLogin = (token, admin) => {
        if (isLoggedIn()) {
            const current = getAdmin();
            revokeToken(token); // throw away the new session — this browser already has one
            if (current?.admin_id === admin.admin_id) {
                navigate("/", { replace: true });
                return;
            }
            setError(`${current?.email || "Another account"} is already signed in on this browser. Log out first to switch accounts.`);
            return;
        }
        saveSession(token, admin);
        navigate("/");
    };

    // Shows the waiting screen and checks every 2 seconds if the other browser answered.
    const startWaiting = (requestId, expiresIn) => {
        setPending({ requestId, secondsLeft: expiresIn });

        countdownRef.current = setInterval(() => {
            setPending((p) => (p ? { ...p, secondsLeft: Math.max(0, p.secondsLeft - 1) } : p));
        }, 1000);

        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/api/admin/login-requests/${requestId}/status`);
                const data = await res.json();

                if (data.status === "approved" && data.token) {
                    stopWaiting();
                    finishLogin(data.token, data.admin);
                } else if (data.status === "denied") {
                    stopWaiting();
                    setError("Your sign-in was denied by the browser where this account is already signed in.");
                } else if (data.status === "expired") {
                    stopWaiting();
                    setError("No response from the other browser. Please try signing in again.");
                } else if (["cancelled", "completed", "not_found"].includes(data.status)) {
                    stopWaiting();
                }
            } catch {
                // server briefly unreachable — keep waiting
            }
        }, POLL_MS);
    };

    // "Cancel" while waiting: withdraws the sign-in request.
    const cancelWaiting = () => {
        const requestId = pending?.requestId;
        stopWaiting();
        if (requestId) {
            fetch(`${API_URL}/api/admin/login-requests/${requestId}/cancel`, { method: "POST" }).catch(() => {});
        }
    };

    if (checkingSetup) return null;

    // "Sign In": checks the email and password with the server.
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        // Format check first, so a typo never reaches the server.
        setEmailTouched(true);
        if (checkEmail(email)) return;
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/admin/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), password }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.message || "Login failed.");
                return;
            }

            // 202 = this account is open in another browser; wait for its approval.
            if (res.status === 202 && data.approval_required) {
                startWaiting(data.request_id, data.expires_in || 60);
                return;
            }

            finishLogin(data.token, data.admin);
        } catch (err) {
            console.error(err);
            setError("Could not reach the server. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-screen min-h-screen flex flex-col bg-[#F7F8F7] font-sans">
            <Header />

            <main className="flex-1 flex items-center justify-center px-4 py-10">
                <div className="w-full max-w-[420px]">
                    <div className="bg-white rounded-[12px] px-7 py-8">
                        {pending ? (
                            // WAITING FOR APPROVAL
                            <div className="text-center">
                                <div className="mx-auto mb-5 w-14 h-14 rounded-full border-[5px] border-[#E8F1E9] border-t-[#1B5E20] animate-spin" />
                                <h1 className="text-[20px] font-extrabold text-gray-900">Waiting for approval</h1>
                                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                                    <span className="font-semibold text-gray-800">{email}</span> is already signed in on another browser.
                                    A prompt was sent there. Ask them to click <span className="font-semibold text-gray-800">Allow</span>.
                                </p>
                                <div className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full bg-[#FBF3DC] text-[#946800] text-xs font-bold tabular-nums">
                                    Expires in {pending.secondsLeft}s
                                </div>
                                <button type="button" onClick={cancelWaiting} className={`${btn.secondary} w-full h-[50px] mt-6`}>
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            // SIGN-IN FORM
                            <>
                                <div className="text-center mb-7">
                                    <h1 className="text-[22px] font-extrabold text-gray-900">Welcome back</h1>
                                    <p className="text-sm text-gray-500 mt-1">Sign in to the library admin dashboard.</p>
                                </div>

                                {error && (
                                    <div className="flex items-start gap-2 rounded-[8px] bg-[#FBDFDB] text-[#B3261E] text-[13px] font-semibold px-4 py-3 mb-5">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="flex-shrink-0 mt-px">
                                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                        <span>{error}</span>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                                    <AuthInput
                                        id="admin-email" name="email" label="Email" icon="mail" type="email" required
                                        autoComplete="username" placeholder="name@cvsu.edu.ph"
                                        value={email} onChange={(e) => setEmail(e.target.value)}
                                        onBlur={() => setEmailTouched(true)}
                                        error={emailTouched && !!checkEmail(email)}
                                    />
                                    {/* Email format message (updates live once shown) */}
                                    {emailTouched && checkEmail(email) && (
                                        <p className="text-[12.5px] text-[#B3261E] -mt-2 ml-0.5">{checkEmail(email)}</p>
                                    )}
                                    <AuthInput
                                        id="admin-password" name="password" label="Password" icon="lock" type="password" required
                                        autoComplete="current-password" placeholder="Enter your password"
                                        value={password} onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        style={{ marginTop: 24 }}
                                        className="w-full h-[52px] rounded-[12px] bg-[#1B5E20] hover:bg-[#164a1a] text-white text-[15px] font-bold tracking-wide transition-colors disabled:opacity-60"
                                    >
                                        {loading ? "Signing in…" : "Sign In"}
                                    </button>
                                </form>

                                <p className="text-center text-[12.5px] text-gray-500 mt-5">
                                    Forgot your password? Ask the super admin to reset it.
                                </p>
                            </>
                        )}
                    </div>
                    <p className="text-center text-[11.5px] text-gray-400 mt-5">
                        Cavite State University · Ladislao N. Diwa Memorial Library
                    </p>
                </div>
            </main>
        </div>
    );
};

export default Login;