// RATE LIMITS — per IP address (one device or network), as an extra layer on top
// of the per-account rules (login lockout, OTP 60-second wait, 5 resets a day).
//
// Why per IP: stops one device or script from spamming the server, e.g. sending
// hundreds of OTP emails (Brevo only allows 300 a day) or fake guest entries.
//
// The numbers are generous on purpose: many students share ONE campus Wi-Fi IP,
// and every guest uses the same kiosk PC. Real users never reach these limits.
// The scanner is NOT limited (every scan comes from the library PC).
//
// Package: npm install express-rate-limit   (inside the backend folder)

const WINDOW_MS = 15 * 60 * 1000; // all limits count requests in a 15-minute window

let rateLimit = null;
try {
    rateLimit = require('express-rate-limit').rateLimit || require('express-rate-limit');
} catch {
    console.warn('[rate limits] express-rate-limit is not installed — limits are OFF. Run: npm install express-rate-limit');
}

// Makes one limiter. Over the limit → 429 with a friendly message and how many
// seconds to wait (the app uses rate_limited to tell this apart from other 429s).
function makeLimiter({ limit, message, skipSuccessfulRequests = false }) {
    if (!rateLimit) return (req, res, next) => next(); // package missing → no limit
    return rateLimit({
        windowMs: WINDOW_MS,
        limit,
        skipSuccessfulRequests,          // true → only failed requests count
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: (req, res) => {
            const resetTime = req.rateLimit?.resetTime;
            const retryAfter = resetTime ? Math.max(1, Math.ceil((resetTime - Date.now()) / 1000)) : 900;
            const minutes = Math.ceil(retryAfter / 60);
            res.status(429).json({
                rate_limited: true,
                retry_after_seconds: retryAfter,
                message: `${message} Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
            });
        },
    });
}

module.exports = {
    // Sending OTP codes (each one is an email from Brevo's 300/day).
    otpLimiter: makeLimiter({ limit: 20, message: 'Too many code requests from this network.' }),
    // Submitting a registration (each one uploads a registration form photo).
    registerLimiter: makeLimiter({ limit: 20, message: 'Too many registration attempts from this network.' }),
    // "Forgot password" emails.
    forgotPasswordLimiter: makeLimiter({ limit: 10, message: 'Too many password reset requests from this network.' }),
    // Logins and password changes: only FAILED attempts count, so normal logins are never blocked.
    loginLimiter: makeLimiter({ limit: 30, message: 'Too many failed attempts from this network.', skipSuccessfulRequests: true }),
    // Guest kiosk log in / log out (all guests share the kiosk PC).
    guestLimiter: makeLimiter({ limit: 60, message: 'Too many guest requests from this device.' }),
    // Live "is this taken?" checks while typing on the Register screen.
    availabilityLimiter: makeLimiter({ limit: 150, message: 'Too many checks from this network.' }),
};
