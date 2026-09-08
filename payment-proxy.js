/**
 * Unified Payment Proxy Server
 * ─────────────────────────────
 * Consolidates the NepalPay (server.js:3001) and Fonepay (fonepay-server.js:3002)
 * proxy servers into a single microservice.
 *
 * Routes:
 *   GET  /health
 *   POST /api/nepalpay/verify-login           (alias: /api/verify-login)
 *   POST /api/nepalpay/trigger-qr             (alias: /api/trigger-nepalpay-qr)
 *   POST /api/nepalpay/verify-transaction     (alias: /api/verify-nepalpay-transaction)
 *   POST /api/fonepay/verify-login
 *   POST /api/fonepay/trigger-qr              (alias: /api/trigger-fonepay-qr)
 *   POST /api/fonepay/verify-transaction      (alias: /api/verify-fonepay-transaction)
 */

const http = require('http');
const crypto = require('crypto');
const util = require('util');
const { execFile } = require('child_process');
const execFilePromise = util.promisify(execFile);
const fs = require('fs');
const path = require('path');

// ── Load .env file (since this is a standalone Node script, not Next.js) ─────
try {
    const envPath = path.resolve(__dirname, '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
    console.log('[PROXY] Loaded environment from .env');
} catch (e) {
    console.warn('[PROXY] Warning: Could not load .env file:', e.message);
}

// ── Shared Utilities ─────────────────────────────────────────────────────────

/** Mask sensitive values for logging (show first 2 + last 2 chars only) */
function maskSensitive(val) {
    if (!val || typeof val !== 'string') return '***';
    if (val.length <= 4) return '***';
    return val.slice(0, 2) + '*'.repeat(Math.min(val.length - 4, 6)) + val.slice(-2);
}

function parseJwt(token) {
    try {
        return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    } catch (e) { return null; }
}

/**
 * Get date string (YYYY-MM-DD) in Nepal Time (Asia/Kathmandu).
 * Supports offset in days and optional base date.
 */
function getNepalDate(offsetDays = 0, baseDate = null) {
    const d = baseDate ? new Date(baseDate) : new Date();
    const targetMs = (isNaN(d.getTime()) ? Date.now() : d.getTime()) + (offsetDays * 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(new Date(targetMs));
}

/**
 * Make an HTTP request to a banking API via curl.
 * Uses execFile (NOT exec) to avoid shell injection and reduce overhead.
 */
async function makeBankRequest(url, payload, token = null, method = 'POST') {
    const args = [
        '-s', '-X', method, url,
        '-H', 'Content-Type: application/json',
        '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    ];

    if (token) {
        args.push('-H', `Authorization: Bearer ${token}`);
    }

    if (method === 'POST' && payload) {
        args.push('-d', JSON.stringify(payload));
    }

    try {
        const { stdout } = await execFilePromise('curl', args);
        const trimmed = stdout.trim();
        if (!trimmed) return null;

        const jsonStart = trimmed.indexOf('{');
        if (jsonStart > 0) {
            return JSON.parse(trimmed.substring(jsonStart));
        }
        return JSON.parse(trimmed);
    } catch (e) {
        throw new Error("Bank request failed (curl): " + e.message + " | RAW OUTPUT: " + (typeof trimmed !== 'undefined' ? trimmed : ""));
    }
}

/**
 * Make a curl request that returns both headers and body (for Fonepay auth).
 * Returns the raw stdout for header extraction.
 */
async function makeBankRequestWithHeaders(url, payload) {
    const args = [
        '-s', '-i', '-X', 'POST', url,
        '-H', 'Content-Type: application/json',
        '-d', JSON.stringify(payload)
    ];

    const { stdout } = await execFilePromise('curl', args);
    return stdout;
}

/**
 * Extract Bearer token from raw curl response headers.
 */
function extractBearerToken(rawResponse) {
    const lines = rawResponse.split('\r\n');
    for (const line of lines) {
        if (line.toLowerCase().startsWith('authorization: bearer')) {
            return line.substring(22).trim();
        }
    }
    return null;
}

// ── Shared State ─────────────────────────────────────────────────────────────

const sessionCache = {};

/**
 * Credential Vault — caches decrypted bank credentials in-memory by provider key.
 * Populated on QR generation (which requires credentials). Used by verify handlers
 * to re-authenticate if the session token expires, without requiring the caller
 * to re-send credentials on every poll request.
 */
const credentialVault = {};

/** Maximum allowed request body size (64 KB) — prevents memory exhaustion DoS */
const MAX_BODY_SIZE = 64 * 1024;

// Periodic cleanup of expired JWT tokens from sessionCache (every 10 minutes)
setInterval(() => {
    let cleaned = 0;
    for (const key of Object.keys(sessionCache)) {
        const token = sessionCache[key];
        const decoded = parseJwt(token);
        if (!decoded || !decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
            delete sessionCache[key];
            cleaned++;
        }
    }
    if (cleaned > 0) console.log(`[CACHE] Cleaned ${cleaned} expired session(s)`);
}, 10 * 60 * 1000);

// Active Fonepay WebSocket connections: Map<transactionId, WebSocket>
const activeFonepayWS = new Map();

// Callback URL for Fonepay WS events (set via env or default)
const CALLBACK_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/**
 * Start a Fonepay WebSocket listener for a specific transaction.
 * Connects to the websocketId URL returned by Fonepay's receivePayment API.
 * Handles both intermediate QR_SCANNED events and final payment VERIFIED/PAID events.
 */
function startFonepayWebSocket(websocketUrl, transactionId, validationTraceId) {
    if (!websocketUrl || !transactionId) return;

    // Close existing WS for this transaction if any
    if (activeFonepayWS.has(transactionId)) {
        try { activeFonepayWS.get(transactionId).close(); } catch (e) {}
        activeFonepayWS.delete(transactionId);
    }

    console.log(`[WS] Opening Fonepay WebSocket for ${transactionId}`);

    try {
        const WebSocketClient = globalThis.WebSocket || (typeof WebSocket !== 'undefined' ? WebSocket : require('ws'));
        const ws = new WebSocketClient(websocketUrl);

        // Auto-close after 6 minutes (safety timeout)
        const timeout = setTimeout(() => {
            console.log(`[WS] Timeout reached for ${transactionId}, closing`);
            try { ws.close(); } catch (e) {}
            activeFonepayWS.delete(transactionId);
        }, 6 * 60 * 1000);

        ws.onopen = () => {
            console.log(`[WS] ✅ Connected to Fonepay WS for ${transactionId}`);
        };

        ws.onmessage = async (event) => {
            try {
                const raw = typeof event.data === 'string' ? event.data : event.data.toString();

                let msg = {};
                try {
                    msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                } catch (e) {
                    console.error(`[WS] JSON parse error for ${transactionId}:`, e.message);
                    return;
                }

                let txStatus = msg.transactionStatus;
                if (typeof txStatus === 'string') {
                    try { txStatus = JSON.parse(txStatus); } catch (e) {}
                }

                const isPaid = (txStatus && txStatus.success === true && (txStatus.message === "SUCCESS" || txStatus.message === "PAID" || txStatus.status === "SUCCESS")) || msg.status === "SUCCESS" || msg.event === "PAID" || msg.event === "SUCCESS";

                const isQrScanned = !isPaid && (
                    (txStatus && (txStatus.qrVerified === true || txStatus.message === "VERIFIED" || txStatus.status === "VERIFIED" || txStatus.isScanned === true)) ||
                    msg.qrVerified === true ||
                    msg.event === "QR_SCANNED" ||
                    msg.event === "SCANNED" ||
                    msg.event === "VERIFIED" ||
                    msg.status === "VERIFIED"
                );

                const webhookUrl = `${CALLBACK_SITE_URL}/api/webhooks/fonepay-ws`;
                const secret = INTERNAL_SECRET || process.env.INTERNAL_API_SECRET;

                try {
                    const resp = await fetch(webhookUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-internal-secret': secret
                        },
                        body: JSON.stringify({
                            transactionId,
                            validationTraceId,
                            provider: 'fonepay',
                            event: isPaid ? 'PAID' : (isQrScanned ? 'QR_SCANNED' : undefined),
                            fonepayData: msg
                        })
                    });
                    console.log(`[WS] Webhook called for ${transactionId} (isPaid: ${isPaid}, isQrScanned: ${isQrScanned})`);
                } catch (e) {
                    console.error(`[WS] Webhook call failed for ${transactionId}:`, e.message);
                }

                if (isPaid) {
                    console.log(`[WS] 🎉 PAYMENT VERIFIED for ${transactionId}!`);
                    clearTimeout(timeout);
                    try { ws.close(); } catch (e) {}
                    activeFonepayWS.delete(transactionId);
                }
            } catch (e) {
                console.error(`[WS] Error processing message for ${transactionId}:`, e.message);
            }
        };

        ws.onerror = (err) => {
            console.error(`[WS] ❌ Error for ${transactionId}:`, err?.message || 'Unknown error');
        };

        ws.onclose = () => {
            console.log(`[WS] Connection closed for ${transactionId}`);
            clearTimeout(timeout);
            activeFonepayWS.delete(transactionId);
        };

        activeFonepayWS.set(transactionId, ws);
    } catch (e) {
        console.error(`[WS] Failed to open WebSocket for ${transactionId}:`, e.message);
    }
}

// ── Security ─────────────────────────────────────────────────────────────────

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;
if (!INTERNAL_SECRET) {
    console.error("FATAL: INTERNAL_API_SECRET environment variable is not set. Exiting.");
    process.exit(1);
}

// ── Fonepay Login Helper ─────────────────────────────────────────────────────
// Fonepay returns the auth token in a response header, not the body.
// This helper handles that quirk.

async function fonepayLogin(userKey, password) {
    const loginPayload = { username: userKey, password: password.trim(), secretKey: "", otpCode: "", recaptcha: "" };
    const rawResponse = await makeBankRequestWithHeaders(
        'https://merchantapi.fonepay.com/authentication/login',
        loginPayload
    );
    const accessToken = extractBearerToken(rawResponse);
    if (accessToken) {
        sessionCache[`fonepay:${userKey}`] = accessToken;
    }
    return accessToken;
}

// ── Route Handlers ───────────────────────────────────────────────────────────

// NepalPay: Verify Login
async function handleNepalPayVerifyLogin(body, res) {
    try {
        const { username, password } = JSON.parse(body);
        const userKey = username.trim();

        console.log(`\n>>> [NEPALPAY] VERIFYING LOGIN FOR ${maskSensitive(userKey)}`);

        const loginData = await makeBankRequest(
            'https://business.nepalpay.com.np/backend/api/auth/signin',
            { username: userKey, password: password.trim() }
        );

        if (loginData.status !== "SUCCESS") {
            console.log("❌ Login Rejected");
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: "Login failed. Check credentials." }));
            return;
        }

        console.log("✅ Login Verified Successfully!");

        const accessToken = loginData.data?.accessToken;
        let merchantCode = null;
        if (accessToken) {
            const decoded = parseJwt(accessToken);
            merchantCode = decoded?.merchantCode || null;
            sessionCache[`nepalpay:${userKey}`] = accessToken;
        }

        // Cache credentials in vault for session token architecture
        credentialVault['nepalpay'] = { username: userKey, password: password.trim() };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: "Credentials valid", merchantCode }));
    } catch (err) {
        console.error("🚨 CRASH:", err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Internal server error" }));
    }
}

// NepalPay: Trigger QR
async function handleNepalPayTriggerQR(body, res) {
    try {
        const parsed = JSON.parse(body);
        const { username, password, amount, remarks } = parsed;
        const userKey = username.trim();

        // Cache credentials in vault for session token architecture
        credentialVault['nepalpay'] = { username: userKey, password: password.trim() };

        let accessToken = null;
        let merchantCode = null;

        // If token passed in request from DB, try to use it
        if (parsed.token) {
            const decoded = parseJwt(parsed.token);
            const now = Math.floor(Date.now() / 1000);
            if (decoded && decoded.exp && (decoded.exp > now + 300)) {
                console.log(`\n⚡ Using DB cached NepalPay session for ${maskSensitive(userKey)}`);
                accessToken = parsed.token;
                merchantCode = decoded.merchantCode;
                sessionCache[`nepalpay:${userKey}`] = accessToken;
            }
        }

        // Check in-memory cache
        if (!accessToken && sessionCache[`nepalpay:${userKey}`]) {
            const cachedToken = sessionCache[`nepalpay:${userKey}`];
            const decoded = parseJwt(cachedToken);
            const now = Math.floor(Date.now() / 1000);
            if (decoded && decoded.exp && (decoded.exp > now + 300)) {
                console.log(`\n⚡ Using cached NepalPay session for ${maskSensitive(userKey)}`);
                accessToken = cachedToken;
                merchantCode = decoded.merchantCode;
            }
        }

        if (!accessToken) {
            console.log(`\n>>> NEPALPAY LOGIN for ${maskSensitive(userKey)}...`);

            const loginData = await makeBankRequest(
                'https://business.nepalpay.com.np/backend/api/auth/signin',
                { username: userKey, password: password.trim() }
            );

            if (loginData.status !== "SUCCESS") {
                console.log("❌ Login Rejected");
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: "Login failed. Check credentials." }));
                return;
            }

            accessToken = loginData.data.accessToken;
            const decoded = parseJwt(accessToken);
            merchantCode = decoded.merchantCode;

            sessionCache[`nepalpay:${userKey}`] = accessToken;
            console.log(`✅ Login Success! Merchant: ${maskSensitive(String(merchantCode))}`);
        }

        console.log(`>>> GENERATING QR FOR Rs. ${amount}...`);

        const qrPayload = {
            merchantCode,
            storeLabel: "",
            terminal: "",
            amount: parseInt(amount),
            // We append a random short ID to remarks to guarantee uniqueness.
            // This prevents banking apps (like Khalti) from blocking it as a "duplicate transaction".
            remarks: (remarks || "Order") + " " + crypto.randomBytes(4).toString('hex').toUpperCase(),
            userDetail: {
                user: username.trim(),
                identificationCode: merchantCode,
                subIdentificationCode: merchantCode
            }
        };

        const qrData = await makeBankRequest(
            'https://business.nepalpay.com.np/backend/api/nqr/generate',
            qrPayload,
            accessToken
        );

        if (qrData.status === "SUCCESS") {
            console.log("✅ QR GENERATED SUCCESSFULLY!");
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                qrString: qrData.data.qrString,
                validationTraceId: qrData.data.validationTraceId || qrData.data.qrId,
                accessToken: accessToken // Return for DB caching
            }));
        } else {
            console.log("❌ QR Generation Failed");
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: "QR Generation Failed" }));
        }

    } catch (err) {
        console.error("🚨 CRASH:", err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Internal server error" }));
    }
}

// NepalPay: Verify Transaction
async function handleNepalPayVerifyTransaction(body, res) {
    try {
        const parsed = JSON.parse(body);
        const { nqrTxnId, phoneNumber, bankReference, amount, remarks, orderCreatedAt } = parsed;
        // Session Token Architecture: Accept sessionToken OR username/password, fall back to credential vault
        let username = parsed.username ? parsed.username.trim() : null;
        let password = parsed.password ? parsed.password.trim() : null;

        const rawRef = String(bankReference || phoneNumber || "").trim();
        const maskedPhone = rawRef ? '***' + rawRef.slice(-4) : 'N/A';
        console.log(`\n🔍 [NEPALPAY VERIFY] Checking nqrTxnId: ${nqrTxnId || 'N/A'}, ref: ${maskedPhone}`);

        let accessToken = null;
        let merchantCode = null;

        // 1. Try session token from request (preferred — no credentials needed)
        if (parsed.sessionToken) {
            const decoded = parseJwt(parsed.sessionToken);
            const now = Math.floor(Date.now() / 1000);
            if (decoded && decoded.exp && (decoded.exp > now + 60)) {
                accessToken = parsed.sessionToken;
                merchantCode = decoded.merchantCode;
                // Refresh session cache with the provided token
                if (decoded.sub || username) {
                    sessionCache[`nepalpay:${decoded.sub || username}`] = accessToken;
                }
            }
        }

        // 2. Try in-memory session cache (keyed by username from vault if needed)
        if (!accessToken) {
            const resolvedUser = username || (credentialVault['nepalpay'] && credentialVault['nepalpay'].username);
            if (resolvedUser && sessionCache[`nepalpay:${resolvedUser}`]) {
                const cachedToken = sessionCache[`nepalpay:${resolvedUser}`];
                const decoded = parseJwt(cachedToken);
                const now = Math.floor(Date.now() / 1000);
                if (decoded && decoded.exp && (decoded.exp > now + 60)) {
                    accessToken = cachedToken;
                    merchantCode = decoded.merchantCode;
                    if (!username) username = resolvedUser;
                }
            }
        }

        // 3. Re-login using credential vault or provided credentials
        if (!accessToken) {
            if (!username || !password) {
                // Try credential vault
                const vaultCreds = credentialVault['nepalpay'];
                if (vaultCreds) {
                    username = vaultCreds.username;
                    password = vaultCreds.password;
                    console.log(`🔑 [NEPALPAY] Using credential vault for re-login`);
                } else {
                    // No credentials available — caller must re-send
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, sessionExpired: true, message: "Session expired. Please retry." }));
                    return;
                }
            }

            console.log(`>>> NEPALPAY LOGIN (VERIFY) for ${maskSensitive(username)}...`);
            const loginData = await makeBankRequest(
                'https://business.nepalpay.com.np/backend/api/auth/signin',
                { username, password }
            );

            if (loginData.status !== "SUCCESS") {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: "Login failed" }));
                return;
            }

            accessToken = loginData.data.accessToken;
            const decoded = parseJwt(accessToken);
            merchantCode = decoded.merchantCode;
            sessionCache[`nepalpay:${username}`] = accessToken;
            // Refresh vault with working credentials
            credentialVault['nepalpay'] = { username, password };
        }

        const todayNpt = getNepalDate(0);
        let fromDate = todayNpt;
        let toDate = todayNpt;

        if (orderCreatedAt) {
            const orderDateNpt = getNepalDate(0, orderCreatedAt);
            fromDate = orderDateNpt;
        } else {
            const nowNptHours = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kathmandu', hour: 'numeric', hour12: false }).format(new Date()));
            if (nowNptHours < 6) {
                fromDate = getNepalDate(-1);
            }
        }

        console.log(`📅 [NEPALPAY] Querying statement range (NPT): ${fromDate} to ${toDate}`);

        const listPayload = {
            merchantCode,
            fromDate: fromDate,
            toDate: toDate,
            storeLabel: "",
            terminal: "",
            nqrTxnId: "", // Fetch all transactions, don't filter by validationTraceId!
            payerMobileNumber: "",
            issuerNetwork: "",
            userDetail: {
                user: username,
                identificationCode: merchantCode,
                subIdentificationCode: merchantCode
            },
            pageable: {
                currentPage: 1,
                rowPerPage: 50,
                paginated: true,
                enable: true
            }
        };

        const listData = await makeBankRequest(
            // Append a timestamp to the URL to bypass any aggressive CDN caching on NepalPay's side
            `https://business.nepalpay.com.np/backend/api/report/transaction/list?_cb=${Date.now()}`,
            listPayload,
            accessToken
        );

        console.log(`🔍 [VERIFY RESPONSE]: fetched ${listData?.data?.totalItem || 0} items`);

        if (listData.status === "SUCCESS" && listData.data) {
            const resultArr = listData.data.result;
            if (Array.isArray(resultArr) && resultArr.length > 0) {
                const cleanDigitsRef = rawRef.replace(/\D/g, "");
                const isManualVerification = rawRef.length >= 6;
                const isPhoneFormat = cleanDigitsRef.length === 10 && (cleanDigitsRef.startsWith("98") || cleanDigitsRef.startsWith("97") || cleanDigitsRef.startsWith("96"));
                const expectedAmount = (amount !== undefined && amount !== null) ? Math.round(parseFloat(String(amount).replace(/,/g, ''))) : 0;

                let matchingTxn = resultArr.find(txn => {
                    const isSuccess = txn.status === "SUCCESS" || txn.paymentStatus === "Success" || txn.status === "Success";
                    if (!isSuccess && txn.status !== undefined) return false;

                    // 1. AMOUNT CHECK:
                    const rawAmount = txn.amount || txn.transactionAmount || "0";
                    const paidAmount = Math.round(parseFloat(String(rawAmount).replace(/,/g, '')));
                    if (expectedAmount > 0 && paidAmount < expectedAmount) {
                        return false; // Underpayment -> REJECT
                    }

                    // 2. Tracking match (QR Trace ID or Remarks/Order ID)
                    const isTraceMatch = nqrTxnId && (txn.validationTraceId === nqrTxnId || txn.nqrTxnId === nqrTxnId);
                    const isRemarksMatch = remarks && txn.remarks && txn.remarks.includes(remarks);

                    if (isManualVerification) {
                        // Check Bank Transaction ID / Instruction ID / RRN match
                        const txnBankId = String(txn.nqrTxnId || txn.transactionId || txn.instructionId || "").trim();
                        const txnRrn = String(txn.retrievalReferenceNumber || txn.rrn || "").trim();

                        const isBankRefMatch = rawRef.length >= 6 && (
                            (txnBankId && (txnBankId === rawRef || txnBankId === cleanDigitsRef)) ||
                            (txnRrn && (txnRrn === rawRef || txnRrn === cleanDigitsRef))
                        );

                        if (isBankRefMatch) {
                            console.log(`🎯 [NEPALPAY] Bank Receipt Ref matched: ${maskedPhone}`);
                            return true;
                        }

                        // Check Phone Match
                        if (isPhoneFormat) {
                            const txnPhoneRaw = txn.payerMobileNumber || txn.customerMobileNumber || txn.payerMobile || txn.mobileNumber || txn.mobileNo || txn.contactNumber || txn.initiator || "";
                            const cleanTxnPhone = txnPhoneRaw.replace(/\D/g, "");
                            const isPhoneMatch = cleanTxnPhone.length >= 10 && cleanTxnPhone.endsWith(cleanDigitsRef.slice(-10));

                            if (isPhoneMatch && (isTraceMatch || isRemarksMatch)) {
                                return true;
                            }
                        }

                        return false;
                    } else {
                        // Active checkout polling
                        return isTraceMatch || isRemarksMatch;
                    }
                });

                // Tier 2 Smart Fallback for NepalPay active checkout
                if (!matchingTxn && !isManualVerification && expectedAmount > 0 && orderCreatedAt) {
                    const orderCreatedMs = new Date(orderCreatedAt).getTime();
                    if (!isNaN(orderCreatedMs)) {
                        const windowStartMs = orderCreatedMs - (60 * 1000);
                        const windowEndMs = orderCreatedMs + (6 * 60 * 1000);

                        matchingTxn = resultArr.find(txn => {
                            const isSuccess = txn.status === "SUCCESS" || txn.paymentStatus === "Success" || txn.status === "Success";
                            if (!isSuccess && txn.status !== undefined) return false;

                            const rawAmount = txn.amount || txn.transactionAmount || "0";
                            const paidAmount = Math.round(parseFloat(String(rawAmount).replace(/,/g, '')));
                            if (paidAmount !== expectedAmount) return false;

                            const rem = txn.remarks ? String(txn.remarks).trim() : "";
                            const isStripped = !rem || rem === "null" || rem === "N/A" || rem === String(expectedAmount);
                            if (!isStripped) return false;

                            const txnTimeStr = txn.transactionDate || txn.paymentDate || txn.createdDate || txn.transmissionDateTime;
                            if (txnTimeStr) {
                                const txnTimeMs = new Date(txnTimeStr).getTime();
                                if (!isNaN(txnTimeMs)) {
                                    return txnTimeMs >= windowStartMs && txnTimeMs <= windowEndMs;
                                }
                            }
                            return false;
                        });
                    }
                }

                if (matchingTxn) {
                    const resolvedTxnId = matchingTxn.nqrTxnId || matchingTxn.transactionId || matchingTxn.instructionId;
                    const resolvedBankTxnId = matchingTxn.nqrTxnId || matchingTxn.transactionId || matchingTxn.retrievalReferenceNumber;
                    console.log(`✅ [VERIFY] MATCH FOUND! Txn ID: ${maskSensitive(String(resolvedTxnId))}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        data: {
                            status: "SUCCESS",
                            txnId: resolvedTxnId,
                            bankTxnId: resolvedBankTxnId,
                            paidAmount: matchingTxn.amount || matchingTxn.transactionAmount,
                            paymentDate: matchingTxn.transactionDate || matchingTxn.paymentDate || matchingTxn.transmissionDateTime
                        }
                    }));
                    return;
                } else {
                    console.log(`⏳ [VERIFY] No match yet for nqrTxnId: ${nqrTxnId || 'N/A'}`);
                }
            }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Transaction not found in list yet", data: null }));

    } catch (err) {
        console.error("🚨 VERIFY CRASH:", err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Internal server error" }));
    }
}

// Fonepay: Verify Login
async function handleFonepayVerifyLogin(body, res) {
    try {
        const { username, password } = JSON.parse(body);
        const userKey = username.trim();

        console.log(`\n>>> [FONEPAY] VERIFYING LOGIN FOR ${maskSensitive(userKey)}`);

        // First check if login is valid via body response
        const loginData = await makeBankRequest(
            'https://merchantapi.fonepay.com/authentication/login',
            { username: userKey, password: password.trim(), secretKey: "", otpCode: "", recaptcha: "" }
        );

        if (!loginData || !loginData.navigationResponse) {
            console.log("❌ Login Rejected");
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: "Login failed. Check credentials." }));
            return;
        }

        console.log("✅ Login Verified Successfully!");

        // Now do the login again with -i to extract the auth header token
        await fonepayLogin(userKey, password);

        // Cache credentials in vault for session token architecture
        credentialVault['fonepay'] = { username: userKey, password: password.trim() };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: "Credentials valid" }));
    } catch (err) {
        console.error("🚨 CRASH:", err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Internal server error" }));
    }
}

// Fonepay: Trigger QR
async function handleFonepayTriggerQR(body, res) {
    try {
        const { username, password, amount, remarks } = JSON.parse(body);
        const userKey = username.trim();

        // Cache credentials in vault for session token architecture
        credentialVault['fonepay'] = { username: userKey, password: password.trim() };

        let accessToken = sessionCache[`fonepay:${userKey}`];

        if (!accessToken) {
            console.log(`\n>>> FONEPAY LOGIN for ${maskSensitive(userKey)}...`);
            accessToken = await fonepayLogin(userKey, password);

            if (!accessToken) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: "Login failed" }));
                return;
            }
        }

        // 1. Fetch Terminal ID
        let terminalData = await makeBankRequest(
            'https://merchantapi.fonepay.com/merchantInfo/fetchSubmerchantTerminalList',
            null,
            accessToken,
            'GET'
        );

        let terminalId = null;
        if (terminalData && terminalData.subMerchantLists && terminalData.subMerchantLists[0]) {
            terminalId = terminalData.subMerchantLists[0].terminalLists[0].id;
        }

        // If it fails, the cached token might be expired! Let's clear cache and retry ONCE.
        if (!terminalId) {
            console.log("⚠️ Fonepay token likely expired. Retrying login...");
            delete sessionCache[`fonepay:${userKey}`];
            accessToken = await fonepayLogin(userKey, password);
            
            if (accessToken) {
                terminalData = await makeBankRequest(
                    'https://merchantapi.fonepay.com/merchantInfo/fetchSubmerchantTerminalList',
                    null,
                    accessToken,
                    'GET'
                );
                if (terminalData && terminalData.subMerchantLists && terminalData.subMerchantLists[0]) {
                    terminalId = terminalData.subMerchantLists[0].terminalLists[0].id;
                }
            }
        }

        if (!terminalId) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: "Terminal ID not found for this merchant. (Token may be invalid)" }));
            return;
        }

        console.log(`>>> GENERATING FONEPAY QR FOR Rs. ${amount}`);

        // Append a random short ID to remarks to guarantee uniqueness.
        const uniqueId = crypto.randomBytes(4).toString('hex').toUpperCase();
        const safeRemarks = ((remarks || "Order") + " " + uniqueId).substring(0, 20);

        const qrPayload = {
            selectTerminal: terminalId,
            billId: safeRemarks,
            amount: amount.toString(),
            terminalId: terminalId,
            qrType: "FONEPAY"
        };

        const qrData = await makeBankRequest(
            'https://merchantapi.fonepay.com/merchantQr/receivePayment',
            qrPayload,
            accessToken
        );

        if (qrData && qrData.qrMessage) {
            console.log("✅ FONEPAY QR GENERATED!");

            // Start WebSocket listener for real-time payment notification
            // This is fire-and-forget — does NOT block QR response
            const wsUrl = qrData.websocketId;
            // The transactionId from the request body (our internal ID from `remarks`)
            const parsed = JSON.parse(body);
            const internalTxnId = parsed.transactionId || safeRemarks;
            if (wsUrl) {
                startFonepayWebSocket(wsUrl, internalTxnId, safeRemarks);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                qrString: qrData.qrMessage,
                validationTraceId: safeRemarks, // Use the billId as the trace
                websocketId: qrData.websocketId
            }));
        } else {
            console.log("❌ Fonepay QR Generation Failed");
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: "Fonepay QR Generation Failed" }));
        }

    } catch (err) {
        console.error("🚨 CRASH:", err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Internal server error" }));
    }
}

// Fonepay: Verify Transaction
async function handleFonepayVerifyTransaction(body, res) {
    try {
        const parsed = JSON.parse(body);
        const { nqrTxnId, phoneNumber, bankReference, amount, remarks, orderCreatedAt } = parsed;
        // Session Token Architecture: Accept sessionToken OR username/password, fall back to credential vault
        let username = parsed.username ? parsed.username.trim() : null;
        let password = parsed.password ? parsed.password.trim() : null;

        const rawRef = String(bankReference || phoneNumber || "").trim();
        const maskedRef = rawRef ? '***' + rawRef.slice(-4) : 'N/A';
        console.log(`\n🔍 [FONEPAY VERIFY] order: ${remarks || 'N/A'}, ref: ${maskedRef}, amount: ${amount}`);

        let accessToken = null;

        // 1. Try session token from request (preferred — no credentials needed)
        if (parsed.sessionToken) {
            // Fonepay tokens are opaque (not JWT), so just use directly
            accessToken = parsed.sessionToken;
        }

        // 2. Try in-memory session cache
        if (!accessToken) {
            const resolvedUser = username || (credentialVault['fonepay'] && credentialVault['fonepay'].username);
            if (resolvedUser && sessionCache[`fonepay:${resolvedUser}`]) {
                accessToken = sessionCache[`fonepay:${resolvedUser}`];
                if (!username) username = resolvedUser;
            }
        }

        // 3. Re-login using credential vault or provided credentials
        if (!accessToken) {
            if (!username || !password) {
                const vaultCreds = credentialVault['fonepay'];
                if (vaultCreds) {
                    username = vaultCreds.username;
                    password = vaultCreds.password;
                    console.log(`🔑 [FONEPAY] Using credential vault for re-login`);
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, sessionExpired: true, message: "Session expired. Please retry." }));
                    return;
                }
            }

            accessToken = await fonepayLogin(username, password);
            if (!accessToken) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: "Login failed" }));
                return;
            }
            // Refresh vault with working credentials
            credentialVault['fonepay'] = { username, password };
        }

        const todayNpt = getNepalDate(0);
        let fromDate = todayNpt;
        let toDate = todayNpt;

        if (orderCreatedAt) {
            const orderDateNpt = getNepalDate(0, orderCreatedAt);
            fromDate = orderDateNpt;
        } else {
            const nowNptHours = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kathmandu', hour: 'numeric', hour12: false }).format(new Date()));
            if (nowNptHours < 6) {
                fromDate = getNepalDate(-1);
            }
        }

        console.log(`📅 [FONEPAY] Querying settlement range (NPT): ${fromDate} to ${toDate}`);

        // Using the Settlement Report API
        const reportUrl = `https://merchantapi.fonepay.com/report/merchant-Settlement-report?pageNumber=1&pageSize=50&fromTransmissionDateTime=${fromDate}&toTransmissionDateTime=${toDate}`;

        const listData = await makeBankRequest(
            reportUrl,
            { id: null, type: null },
            accessToken
        );

        if (listData && listData.searchedDataList && Array.isArray(listData.searchedDataList)) {
            console.log(`🔍 [VERIFY RESPONSE]: fetched ${listData.searchedDataList.length} settlement items`);

            const resultArr = listData.searchedDataList;
            const searchBillId = nqrTxnId || remarks;
            
            const cleanDigitsRef = rawRef.replace(/\D/g, "");
            const isManualVerification = rawRef.length >= 6;
            const isPhoneFormat = cleanDigitsRef.length === 10 && (cleanDigitsRef.startsWith("98") || cleanDigitsRef.startsWith("97") || cleanDigitsRef.startsWith("96"));

            const expectedAmount = (amount !== undefined && amount !== null) ? Math.round(parseFloat(String(amount).replace(/,/g, ''))) : 0;

            // ====================================================================
            // TIER 1: EXACT MATCH (Standard Bill ID / Remarks OR Bank Txn ID / Phone)
            // ====================================================================
            let matchingTxn = resultArr.find(txn => {
                const isSuccess = txn.paymentStatus === "Success" || txn.status === "SUCCESS" || txn.status === "Success";
                if (!isSuccess) return false;

                // 1. AMOUNT CHECK:
                const rawAmount = txn.transactionAmount || txn.amount || "0";
                const paidAmount = Math.round(parseFloat(String(rawAmount).replace(/,/g, '')));
                if (expectedAmount > 0 && paidAmount < expectedAmount) {
                    return false; // Underpayment -> REJECT
                }

                // 2. Exact Tracking Match (Bill ID or Remarks/Order ID)
                const isTrackingMatch = searchBillId && (
                    txn.billId === searchBillId || 
                    txn.remarks1 === searchBillId || 
                    (txn.remarks1 && txn.remarks1.includes(searchBillId))
                );

                if (isManualVerification) {
                    // PILLAR 2: Check if rawRef matches Bank Transaction ID or Retrieval Reference Number (from receipt)
                    const txnBankId = String(txn.fonepayTransactionId || txn.id || "").trim();
                    const txnRrn = String(txn.retrievalReferenceNumber || txn.rrn || "").trim();
                    const txnPrn = String(txn.prnNumber || txn.prn || "").trim();

                    const isBankRefMatch = rawRef.length >= 6 && (
                        (txnBankId && (txnBankId === rawRef || txnBankId === cleanDigitsRef)) ||
                        (txnRrn && (txnRrn === rawRef || txnRrn === cleanDigitsRef)) ||
                        (txnPrn && (txnPrn === rawRef || txnPrn === cleanDigitsRef))
                    );

                    if (isBankRefMatch) {
                        console.log(`🎯 [FONEPAY] Bank Receipt Ref matched: ${maskedRef}`);
                        return true;
                    }

                    // Check Phone Match if input is 10-digit phone
                    if (isPhoneFormat) {
                        const txnPhoneRaw = txn.initiator || txn.mobileNumber || txn.payerMobileNumber || txn.customerMobileNumber || txn.mobileNo || "";
                        const cleanTxnPhone = txnPhoneRaw.replace(/\D/g, "");
                        const isPhoneMatch = cleanTxnPhone.length >= 10 && cleanTxnPhone.endsWith(cleanDigitsRef.slice(-10));

                        if (isPhoneMatch && isTrackingMatch) {
                            return true;
                        }
                    }

                    return false;
                } else {
                    // Active checkout polling
                    return isTrackingMatch;
                }
            });

            // ====================================================================
            // TIER 2: PILLAR 1 ACTIVE-WINDOW SMART FALLBACK (For YONO SBI / stripped apps)
            // ====================================================================
            if (!matchingTxn && !isManualVerification && expectedAmount > 0 && orderCreatedAt) {
                const orderCreatedMs = new Date(orderCreatedAt).getTime();
                if (!isNaN(orderCreatedMs)) {
                    const windowStartMs = orderCreatedMs - (60 * 1000); // 1 min clock drift
                    const windowEndMs = orderCreatedMs + (6 * 60 * 1000); // 5m checkout + 1m grace

                    matchingTxn = resultArr.find(txn => {
                        const isSuccess = txn.paymentStatus === "Success" || txn.status === "SUCCESS" || txn.status === "Success";
                        if (!isSuccess) return false;

                        // 1. Exact Amount Match
                        const rawAmount = txn.transactionAmount || txn.amount || "0";
                        const paidAmount = Math.round(parseFloat(String(rawAmount).replace(/,/g, '')));
                        if (paidAmount !== expectedAmount) return false;

                        // 2. Stripped Remarks Verification: must be null, empty, or equal to amount (e.g. "1360")
                        const r1 = txn.remarks1 ? String(txn.remarks1).trim() : "";
                        const isStripped = !r1 || r1 === "null" || r1 === "N/A" || r1 === String(expectedAmount);
                        if (!isStripped) {
                            // Contains another order's distinct ID -> REJECT to avoid collisions
                            return false;
                        }

                        // 3. Time Window Check (must have occurred during active 5-min checkout)
                        const txnTimeStr = txn.dateTransmissionDateTime || txn.transmissionDateTime || txn.paymentDate || txn.createdDate;
                        if (txnTimeStr) {
                            const txnTimeMs = new Date(txnTimeStr).getTime();
                            if (!isNaN(txnTimeMs)) {
                                const inWindow = txnTimeMs >= windowStartMs && txnTimeMs <= windowEndMs;
                                if (inWindow) {
                                    console.log(`⚡ [FONEPAY SMART FALLBACK] Matched stripped-remarks payment within active window`);
                                    return true;
                                }
                            }
                        }

                        return false;
                    });
                }
            }

            if (matchingTxn) {
                const resolvedTxnId = matchingTxn.fonepayTransactionId || matchingTxn.id;
                const resolvedBankTxnId = matchingTxn.fonepayTransactionId || matchingTxn.retrievalReferenceNumber || matchingTxn.id;
                console.log(`✅ [VERIFY] MATCH FOUND! Txn ID: ${maskSensitive(String(resolvedTxnId))}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    data: {
                        status: "SUCCESS",
                        txnId: resolvedTxnId,
                        bankTxnId: resolvedBankTxnId,
                        paidAmount: matchingTxn.transactionAmount || matchingTxn.amount,
                        paymentDate: matchingTxn.dateTransmissionDateTime || matchingTxn.transmissionDateTime || matchingTxn.paymentDate
                    }
                }));
                return;
            } else {
                console.log(`⏳ [VERIFY] No match found yet for ${remarks || nqrTxnId || 'N/A'}`);
            }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Transaction not found in list yet", data: null }));

    } catch (err) {
        console.error("🚨 VERIFY CRASH:", err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Internal server error" }));
    }
}

// ── Route Table ──────────────────────────────────────────────────────────────
// Maps URL paths to handler functions. Includes both new clean routes and
// backward-compatible aliases so existing consumers keep working.

const ROUTE_TABLE = {
    // NepalPay routes
    '/api/nepalpay/verify-login':       handleNepalPayVerifyLogin,
    '/api/verify-login':                handleNepalPayVerifyLogin,      // legacy alias
    '/api/nepalpay/trigger-qr':         handleNepalPayTriggerQR,
    '/api/trigger-nepalpay-qr':         handleNepalPayTriggerQR,       // legacy alias
    '/api/nepalpay/verify-transaction': handleNepalPayVerifyTransaction,
    '/api/verify-nepalpay-transaction': handleNepalPayVerifyTransaction, // legacy alias

    // Fonepay routes
    '/api/fonepay/verify-login':        handleFonepayVerifyLogin,
    '/api/fonepay/trigger-qr':          handleFonepayTriggerQR,
    '/api/trigger-fonepay-qr':          handleFonepayTriggerQR,        // legacy alias
    '/api/fonepay/verify-transaction':  handleFonepayVerifyTransaction,
    '/api/verify-fonepay-transaction':  handleFonepayVerifyTransaction, // legacy alias
};

// ── HTTP Server ──────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
    const url = req.url;

    // --- SECURITY: Reject browser-origin requests (this is a server-to-server proxy only) ---
    if (req.headers['origin'] || req.headers['referer']) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Forbidden" }));
        return;
    }

    // --- INTERNAL SECRET AUTHENTICATION ---
    if (url.startsWith('/api/') && req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Forbidden" }));
        return;
    }

    // Reject CORS preflight (no browser should be calling this)
    if (req.method === 'OPTIONS') {
        res.writeHead(405);
        res.end();
        return;
    }

    // Health & Keep-Alive check (handles GET /, GET /health)
    if (req.method === 'GET' && (url === '/' || url === '/health' || url.startsWith('/health') || url.startsWith('/?'))) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    // Route matching with body size limit
    if (req.method === 'POST' && ROUTE_TABLE[url]) {
        let body = '';
        let bodySize = 0;
        let destroyed = false;

        req.on('data', chunk => {
            bodySize += chunk.length;
            if (bodySize > MAX_BODY_SIZE) {
                if (!destroyed) {
                    destroyed = true;
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: "Payload too large" }));
                    req.destroy();
                }
                return;
            }
            body += chunk;
        });
        req.on('end', () => {
            if (!destroyed) {
                ROUTE_TABLE[url](body, res);
            }
        });
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

// ── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || process.env.PAYMENT_PROXY_PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🏦 Payment Proxy running on port ${PORT}`);
    console.log(`   Providers: NepalPay + Fonepay (unified)`);
    console.log(`   Routes:`);
    console.log(`     POST /api/nepalpay/verify-login`);
    console.log(`     POST /api/nepalpay/trigger-qr`);
    console.log(`     POST /api/nepalpay/verify-transaction`);
    console.log(`     POST /api/fonepay/verify-login`);
    console.log(`     POST /api/fonepay/trigger-qr`);
    console.log(`     POST /api/fonepay/verify-transaction\n`);
});
