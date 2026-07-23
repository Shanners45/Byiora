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

function parseJwt(token) {
    try {
        return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    } catch (e) { return null; }
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

// Active Fonepay WebSocket connections: Map<transactionId, WebSocket>
const activeFonepayWS = new Map();

// Callback URL for Fonepay WS events (set via env or default)
const CALLBACK_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/**
 * Start a Fonepay WebSocket listener for a specific transaction.
 * Connects to the websocketId URL returned by Fonepay's receivePayment API.
 * When a VERIFIED message is received, calls the Next.js webhook to fulfill the order.
 */
function startFonepayWebSocket(websocketUrl, transactionId, validationTraceId) {
    if (!websocketUrl || !transactionId) return;

    // Close existing WS for this transaction if any
    if (activeFonepayWS.has(transactionId)) {
        try { activeFonepayWS.get(transactionId).close(); } catch (e) {}
        activeFonepayWS.delete(transactionId);
    }

    console.log(`[WS] Opening Fonepay WebSocket for ${transactionId}`);
    console.log(`[WS] URL: ${websocketUrl}`);

    try {
        const ws = new WebSocket(websocketUrl);

        // Auto-close after 6 minutes (safety timeout)
        const timeout = setTimeout(() => {
            console.log(`[WS] Timeout reached for ${transactionId}, closing`);
            try { ws.close(); } catch (e) {}
            activeFonepayWS.delete(transactionId);
        }, 6 * 60 * 1000);

        ws.addEventListener('open', () => {
            console.log(`[WS] ✅ Connected to Fonepay WS for ${transactionId}`);
        });

        ws.addEventListener('message', async (event) => {
            try {
                const raw = typeof event.data === 'string' ? event.data : event.data.toString();
                console.log(`[WS] 📩 Message for ${transactionId}:`, raw);

                const msg = JSON.parse(raw);
                let txStatus = msg.transactionStatus;
                if (typeof txStatus === 'string') {
                    try { txStatus = JSON.parse(txStatus); } catch (e) {}
                }

                // Call the fulfillment webhook for EVERY message so the backend can update status
                try {
                    const webhookUrl = `${CALLBACK_SITE_URL}/api/webhooks/fonepay-ws`;
                    const resp = await fetch(webhookUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-internal-secret': INTERNAL_SECRET
                        },
                        body: JSON.stringify({
                            transactionId,
                            validationTraceId,
                            provider: 'fonepay',
                            fonepayData: msg
                        })
                    });
                    const result = await resp.json().catch(() => ({}));
                    console.log(`[WS] Webhook response for ${transactionId}:`, resp.status, result);
                } catch (e) {
                    console.error(`[WS] Webhook call failed for ${transactionId}:`, e.message);
                }

                if (txStatus && txStatus.success && txStatus.qrVerified) {
                    console.log(`[WS] 🎉 PAYMENT VERIFIED for ${transactionId}!`);
                    // Close the WebSocket
                    clearTimeout(timeout);
                    try { ws.close(); } catch (e) {}
                    activeFonepayWS.delete(transactionId);
                }
            } catch (e) {
                console.error(`[WS] Error parsing message for ${transactionId}:`, e.message);
            }
        });

        ws.addEventListener('error', (err) => {
            console.error(`[WS] ❌ Error for ${transactionId}:`, err.message || 'Unknown error');
        });

        ws.addEventListener('close', () => {
            console.log(`[WS] Connection closed for ${transactionId}`);
            clearTimeout(timeout);
            activeFonepayWS.delete(transactionId);
        });

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

        console.log("\n>>> [NEPALPAY] VERIFYING LOGIN FOR", userKey);

        const loginData = await makeBankRequest(
            'https://business.nepalpay.com.np/backend/api/auth/signin',
            { username: userKey, password: password.trim() }
        );

        if (loginData.status !== "SUCCESS") {
            console.log("❌ Login Rejected:", loginData);
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

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: "Credentials valid", merchantCode }));
    } catch (err) {
        console.error("🚨 CRASH:", err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Crash: " + err.message }));
    }
}

// NepalPay: Trigger QR
async function handleNepalPayTriggerQR(body, res) {
    try {
        const parsed = JSON.parse(body);
        const { username, password, amount, remarks } = parsed;
        const userKey = username.trim();

        let accessToken = null;
        let merchantCode = null;

        // If token passed in request from DB, try to use it
        if (parsed.token) {
            const decoded = parseJwt(parsed.token);
            const now = Math.floor(Date.now() / 1000);
            if (decoded && decoded.exp && (decoded.exp > now + 300)) {
                console.log("\n⚡ Using DB cached NepalPay session for", userKey);
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
                console.log("\n⚡ Using cached NepalPay session for", userKey);
                accessToken = cachedToken;
                merchantCode = decoded.merchantCode;
            }
        }

        if (!accessToken) {
            console.log("\n>>> NEPALPAY LOGIN (VIA CURL)...");

            const loginData = await makeBankRequest(
                'https://business.nepalpay.com.np/backend/api/auth/signin',
                { username: userKey, password: password.trim() }
            );

            if (loginData.status !== "SUCCESS") {
                console.log("❌ Login Rejected:", loginData);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: "Login failed. Check credentials." }));
                return;
            }

            console.log("LOGIN DATA:", JSON.stringify(loginData).substring(0, 1000));
            accessToken = loginData.data.accessToken;
            const decoded = parseJwt(accessToken);
            merchantCode = decoded.merchantCode;

            sessionCache[`nepalpay:${userKey}`] = accessToken;
            console.log("✅ Login Success! Merchant Code:", merchantCode);
        }

        console.log(">>> GENERATING QR FOR Rs.", amount, "...");

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

        console.log(">>> QR PAYLOAD:", JSON.stringify(qrPayload));

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
            console.log("❌ QR Failed:", qrData);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: "QR Generation Failed" }));
        }

    } catch (err) {
        console.error("🚨 CRASH:", err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Crash: " + err.message }));
    }
}

// NepalPay: Verify Transaction
async function handleNepalPayVerifyTransaction(body, res) {
    try {
        const { nqrTxnId, username, password, phoneNumber, amount, remarks } = JSON.parse(body);
        const userKey = username.trim();

        console.log(`\n🔍 [NEPALPAY VERIFY] Checking nqrTxnId: ${nqrTxnId} or phone: ${phoneNumber} for user ${userKey}`);

        let accessToken = null;
        let merchantCode = null;

        // Check cache
        if (sessionCache[`nepalpay:${userKey}`]) {
            const cachedToken = sessionCache[`nepalpay:${userKey}`];
            const decoded = parseJwt(cachedToken);
            const now = Math.floor(Date.now() / 1000);
            if (decoded && decoded.exp && (decoded.exp > now + 300)) {
                accessToken = cachedToken;
                merchantCode = decoded.merchantCode;
            }
        }

        if (!accessToken) {
            console.log("\n>>> NEPALPAY LOGIN (VERIFICATION)...");
            const loginData = await makeBankRequest(
                'https://business.nepalpay.com.np/backend/api/auth/signin',
                { username: userKey, password: password.trim() }
            );

            if (loginData.status !== "SUCCESS") {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: "Login failed" }));
                return;
            }

            accessToken = loginData.data.accessToken;
            const decoded = parseJwt(accessToken);
            merchantCode = decoded.merchantCode;
            sessionCache[`nepalpay:${userKey}`] = accessToken;
        }

        const today = new Date().toISOString().split('T')[0];

        const listPayload = {
            merchantCode,
            fromDate: today,
            toDate: today,
            storeLabel: "",
            terminal: "",
            nqrTxnId: "", // Fetch all transactions, don't filter by validationTraceId!
            payerMobileNumber: "",
            issuerNetwork: "",
            userDetail: {
                user: userKey,
                identificationCode: merchantCode,
                subIdentificationCode: merchantCode
            },
            pageable: {
                currentPage: 1,
                rowPerPage: 10,
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
                const matchingTxn = resultArr.find(txn => {
                    if (nqrTxnId && txn.validationTraceId === nqrTxnId) return true;
                    if (phoneNumber && amount) {
                        const cleanTxnPhone = (txn.payerMobileNumber || txn.customerMobileNumber || "").replace(/\D/g, "");
                        const isPhoneMatch = cleanTxnPhone && cleanTxnPhone.endsWith(phoneNumber.slice(-10));
                        const isAmountMatch = txn.amount === amount || parseInt(txn.amount) === parseInt(amount);
                        if (isPhoneMatch && isAmountMatch) return true;
                    }
                    // Fallback check on remarks if provided
                    if (remarks && txn.remarks && txn.remarks.includes(remarks)) return true;
                    return false;
                });

                if (matchingTxn) {
                    console.log(`✅ [VERIFY] MATCH FOUND! Final Txn ID:`, matchingTxn.nqrTxnId || matchingTxn.transactionId);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        data: {
                            status: "SUCCESS",
                            txnId: matchingTxn.nqrTxnId || matchingTxn.transactionId || matchingTxn.instructionId,
                            bankTxnId: matchingTxn.nqrTxnId || matchingTxn.transactionId,
                            raw: matchingTxn
                        }
                    }));
                    return;
                } else {
                    console.log(`⏳ [VERIFY] No match yet for validationTraceId: ${nqrTxnId}`);
                }
            }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Transaction not found in list yet", data: null }));

    } catch (err) {
        console.error("🚨 VERIFY CRASH:", err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Crash: " + err.message }));
    }
}

// Fonepay: Verify Login
async function handleFonepayVerifyLogin(body, res) {
    try {
        const { username, password } = JSON.parse(body);
        const userKey = username.trim();

        console.log("\n>>> [FONEPAY] VERIFYING LOGIN FOR", userKey);

        // First check if login is valid via body response
        const loginData = await makeBankRequest(
            'https://merchantapi.fonepay.com/authentication/login',
            { username: userKey, password: password.trim(), secretKey: "", otpCode: "", recaptcha: "" }
        );

        if (!loginData || !loginData.navigationResponse) {
            console.log("❌ Login Rejected:", loginData);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: "Login failed. Check credentials." }));
            return;
        }

        console.log("✅ Login Verified Successfully!");

        // Now do the login again with -i to extract the auth header token
        await fonepayLogin(userKey, password);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: "Credentials valid" }));
    } catch (err) {
        console.error("🚨 CRASH:", err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Crash: " + err.message }));
    }
}

// Fonepay: Trigger QR
async function handleFonepayTriggerQR(body, res) {
    try {
        const { username, password, amount, remarks } = JSON.parse(body);
        const userKey = username.trim();

        let accessToken = sessionCache[`fonepay:${userKey}`];

        if (!accessToken) {
            console.log("\n>>> FONEPAY LOGIN...");
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

        console.log(">>> GENERATING FONEPAY QR FOR Rs.", amount, " TERMINAL:", terminalId);

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
            console.log("❌ QR Failed:", qrData);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: "Fonepay QR Generation Failed" }));
        }

    } catch (err) {
        console.error("🚨 CRASH:", err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Crash: " + err.message }));
    }
}

// Fonepay: Verify Transaction
async function handleFonepayVerifyTransaction(body, res) {
    try {
        const { nqrTxnId, username, password, phoneNumber, amount, remarks } = JSON.parse(body);
        const userKey = username.trim();

        console.log(`\n🔍 [FONEPAY VERIFY] Checking for order: ${remarks} or ${nqrTxnId}`);

        let accessToken = sessionCache[`fonepay:${userKey}`];

        if (!accessToken) {
            accessToken = await fonepayLogin(userKey, password);
            if (!accessToken) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: "Login failed" }));
                return;
            }
        }

        const today = new Date().toISOString().split('T')[0];

        // Using the Settlement Report API
        const reportUrl = `https://merchantapi.fonepay.com/report/merchant-Settlement-report?pageNumber=1&pageSize=25&fromTransmissionDateTime=${today}&toTransmissionDateTime=${today}`;

        const listData = await makeBankRequest(
            reportUrl,
            { id: null, type: null },
            accessToken
        );

        if (listData && listData.searchedDataList && Array.isArray(listData.searchedDataList)) {
            console.log(`🔍 [VERIFY RESPONSE]: fetched ${listData.searchedDataList.length} settlement items`);

            const resultArr = listData.searchedDataList;
            const searchBillId = nqrTxnId || remarks;

            const matchingTxn = resultArr.find(txn => {
                let isAmountMatch = true;
                if (amount !== undefined && amount !== null) {
                    isAmountMatch = txn.transactionAmount === amount.toString() || parseInt(txn.transactionAmount) === parseInt(amount);
                }

                const isSuccess = txn.paymentStatus === "Success";
                const isTrackingMatch = searchBillId && (txn.billId === searchBillId || txn.remarks1 === searchBillId);

                // Fallback matching if they typed the phone number
                let isPhoneMatch = false;
                if (phoneNumber && txn.initiator) {
                    const cleanPhone = txn.initiator.replace(/\D/g, "");
                    isPhoneMatch = cleanPhone.endsWith(phoneNumber.slice(-10));
                }

                return isSuccess && (isTrackingMatch || (isPhoneMatch && isAmountMatch));
            });

            if (matchingTxn) {
                console.log(`✅ [VERIFY] MATCH FOUND! Final Txn ID:`, matchingTxn.fonepayTransactionId || matchingTxn.id);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    data: {
                        status: "SUCCESS",
                        txnId: matchingTxn.fonepayTransactionId || matchingTxn.id,
                        bankTxnId: matchingTxn.fonepayTransactionId || matchingTxn.retrievalReferenceNumber,
                        raw: matchingTxn
                    }
                }));
                return;
            } else {
                console.log(`⏳ [VERIFY] No match found yet for ${searchBillId}`);
            }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Transaction not found in list yet", data: null }));

    } catch (err) {
        console.error("🚨 VERIFY CRASH:", err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Crash: " + err.message }));
    }
}

/**
 * Start WebSocket listener for Fonepay QR code scanning/payment events.
 * Listens to Fonepay's WebSocket and posts to Byiora's fonepay-ws webhook upon payment.
 */
function startFonepayWebSocket(wsUrl, transactionId, traceId) {
    if (!wsUrl) return;

    try {
        console.log(`[FONEPAY WS] Connecting to ${wsUrl} for transaction ${transactionId}...`);
        const WebSocketClient = globalThis.WebSocket || require('ws');
        const ws = new WebSocketClient(wsUrl);

        ws.onopen = () => {
            console.log(`[FONEPAY WS] Connected for ${transactionId}`);
        };

        ws.onmessage = async (event) => {
            console.log(`[FONEPAY WS MESSAGE] ${transactionId}:`, event.data);
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                
                let innerStatus = {};
                if (data.transactionStatus) {
                    try {
                        innerStatus = typeof data.transactionStatus === 'string' ? JSON.parse(data.transactionStatus) : data.transactionStatus;
                    } catch (e) {}
                }

                const isQrVerified = innerStatus.qrVerified === true || innerStatus.message === "VERIFIED" || data.event === "QR_SCANNED";
                const isPaid = (innerStatus.success === true && (innerStatus.message === "SUCCESS" || innerStatus.message === "PAID")) || data.status === "SUCCESS" || data.event === "PAID";

                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
                const targetUrl = `${siteUrl}/api/webhooks/fonepay-ws`;
                const secret = process.env.INTERNAL_API_SECRET || "byiora-internal-secret-2026-key";

                if (isQrVerified && !isPaid) {
                    console.log(`📷 [FONEPAY WS] QR SCANNED DETECTED for ${transactionId}!`);
                    const args = [
                        '-s', '-X', 'POST', targetUrl,
                        '-H', 'Content-Type: application/json',
                        '-H', `x-internal-secret: ${secret}`,
                        '-d', JSON.stringify({ transactionId, validationTraceId: traceId, provider: "fonepay", event: "QR_SCANNED" })
                    ];
                    execFilePromise('curl', args).catch(err => console.error("[FONEPAY WS HOOK ERR]", err.message));
                } else if (isPaid) {
                    console.log(`🎉 [FONEPAY WS] PAYMENT CONFIRMED for ${transactionId}! Notifying web app...`);
                    const args = [
                        '-s', '-X', 'POST', targetUrl,
                        '-H', 'Content-Type: application/json',
                        '-H', `x-internal-secret: ${secret}`,
                        '-d', JSON.stringify({ transactionId, validationTraceId: traceId, provider: "fonepay" })
                    ];
                    execFilePromise('curl', args).catch(err => console.error("[FONEPAY WS HOOK ERR]", err.message));
                    ws.close();
                }
            } catch (err) {
                console.error(`[FONEPAY WS PARSE ERROR]`, err.message);
            }
        };

        ws.onerror = (err) => {
            console.error(`[FONEPAY WS ERROR] ${transactionId}:`, err.message || err);
        };

        ws.onclose = () => {
            console.log(`[FONEPAY WS CLOSED] ${transactionId}`);
        };
    } catch (e) {
        console.error(`[FONEPAY WS INIT ERROR]`, e.message);
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

    // --- INTERNAL SECURITY CHECK ---
    if (url.startsWith('/api/') && req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Forbidden: Invalid internal secret" }));
        return;
    }

    // CORS
    const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-internal-secret');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Health check
    if (req.method === 'GET' && url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', providers: ['nepalpay', 'fonepay'], activeWebSockets: activeFonepayWS.size }));
        return;
    }

    // Route matching
    if (req.method === 'POST' && ROUTE_TABLE[url]) {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => ROUTE_TABLE[url](body, res));
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
