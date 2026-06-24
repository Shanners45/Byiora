const http = require('http');
const fs = require('fs');
const util = require('util');
const { execFile } = require('child_process');
const execFilePromise = util.promisify(execFile);

function parseJwt(token) {
    try {
        return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    } catch (e) { return null; }
}

async function makeBankRequest(url, payload, token = null) {
    const args = [
        '-s', '-X', 'POST', url,
        '-H', 'Content-Type: application/json',
        '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    ];
    
    if (token) {
        args.push('-H', `Authorization: Bearer ${token}`);
    }

    args.push('-d', JSON.stringify(payload));

    try {
        const { stdout } = await execFilePromise('curl', args);
        const trimmed = stdout.trim();
        const jsonStart = trimmed.indexOf('{');
        
        if (jsonStart > 0) {
            return JSON.parse(trimmed.substring(jsonStart));
        }
        return JSON.parse(trimmed);
    } catch (e) {
        throw new Error("Bank request failed (curl): " + e.message);
    }
}

const sessionCache = {};
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "dev-secret-key"; // Set this in your Render environment variables

const server = http.createServer(async (req, res) => {
    // --- INTERNAL SECURITY CHECK ---
    if (req.url.startsWith('/api/') && req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Forbidden: Invalid internal secret" }));
        return;
    }

    // CORS — use env or restrict to known origins
    const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-internal-secret');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    // --- NEW ENDPOINT: VERIFY LOGIN CREDENTIALS ONLY ---
    if (req.method === 'POST' && req.url === '/api/verify-login') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { username, password } = JSON.parse(body);
                const userKey = username.trim();

                console.log("\n>>> VERIFYING LOGIN FOR", userKey);
                
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
                    
                    // Cache the token to avoid re-login on next request
                    sessionCache[userKey] = accessToken;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: "Credentials valid", merchantCode }));
            } catch (err) {
                console.error("🚨 CRASH:", err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: "Crash: " + err.message }));
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/api/trigger-nepalpay-qr') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { username, password, amount, remarks } = JSON.parse(body);
                const userKey = username.trim();

                let accessToken = null;
                let merchantCode = null;
                
                // If token passed in request from DB, try to use it
                if (body && JSON.parse(body).token) {
                    const reqToken = JSON.parse(body).token;
                    const decoded = parseJwt(reqToken);
                    const now = Math.floor(Date.now() / 1000);
                    if (decoded && decoded.exp && (decoded.exp > now + 300)) {
                        console.log("\n⚡ Using DB cached NepalPay session for", userKey);
                        accessToken = reqToken;
                        merchantCode = decoded.merchantCode;
                        sessionCache[userKey] = accessToken;
                    }
                }

                // Check cache first
                if (!accessToken && sessionCache[userKey]) {
                    const cachedToken = sessionCache[userKey];
                    const decoded = parseJwt(cachedToken);
                    const now = Math.floor(Date.now() / 1000);
                    
                    // Use cached token if it has more than 5 minutes before expiry
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
                    
                    // Store in cache
                    sessionCache[userKey] = accessToken;
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
                    remarks: (remarks || "Order") + " " + Math.random().toString(36).substring(2, 8).toUpperCase(),
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
        });
        return;
    }

    // --- NEW ENDPOINT: VERIFY TRANSACTION ---
    if (req.method === 'POST' && req.url === '/api/verify-nepalpay-transaction') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { nqrTxnId, username, password, phoneNumber, amount, remarks } = JSON.parse(body);
                const userKey = username.trim();

                console.log(`\n🔍 [VERIFY] Checking nqrTxnId: ${nqrTxnId} or phone: ${phoneNumber} for user ${userKey}`);

                let accessToken = null;
                let merchantCode = null;
                
                // Check cache first
                if (sessionCache[userKey]) {
                    const cachedToken = sessionCache[userKey];
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
                    sessionCache[userKey] = accessToken;
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
                        // So we search the recent transactions list for a matching validationTraceId OR phone+amount
                        const matchingTxn = resultArr.find(txn => {
                            if (nqrTxnId && txn.validationTraceId === nqrTxnId) return true;
                            if (phoneNumber && amount) {
                                // Sometimes phone numbers have country codes or slightly differ, so we check if it ends with the user's phone
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
        });
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`\n🏦 NepalPay Proxy running on http://localhost:${PORT}`);
    console.log(`   POST /api/trigger-nepalpay-qr  →  Curl-based QR generation\n`);
});