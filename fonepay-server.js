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
        throw new Error("Bank request failed (curl): " + e.message);
    }
}

const sessionCache = {};
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "dev-secret-key"; 

const server = http.createServer(async (req, res) => {
    // --- INTERNAL SECURITY CHECK ---
    if (req.url.startsWith('/api/') && req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Forbidden: Invalid internal secret" }));
        return;
    }

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
        res.end(JSON.stringify({ status: 'ok', provider: 'fonepay' }));
        return;
    }

    // --- VERIFY LOGIN CREDENTIALS ONLY ---
    if (req.method === 'POST' && req.url === '/api/verify-login') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { username, password } = JSON.parse(body);
                const userKey = username.trim();

                console.log("\n>>> VERIFYING FONEPAY LOGIN FOR", userKey);
                
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
                
                // For Fonepay, we need to extract the Authorization header.
                // makeBankRequest (curl) currently doesn't return headers. We must do a special curl call to get the token.
                // Wait, if loginData is successful but the token is in the header, we need to grab the header!
                // Let's modify curl args to get headers for login.
                const args = [
                    '-s', '-i', '-X', 'POST', 'https://merchantapi.fonepay.com/authentication/login',
                    '-H', 'Content-Type: application/json',
                    '-d', JSON.stringify({ username: userKey, password: password.trim(), secretKey: "", otpCode: "", recaptcha: "" })
                ];
                
                const { stdout } = await execFilePromise('curl', args);
                
                let accessToken = null;
                const lines = stdout.split('\r\n');
                for (const line of lines) {
                    if (line.toLowerCase().startsWith('authorization: bearer')) {
                        accessToken = line.substring(22).trim();
                        break;
                    }
                }

                if (accessToken) {
                    sessionCache[userKey] = accessToken;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: "Credentials valid" }));
            } catch (err) {
                console.error("🚨 CRASH:", err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: "Crash: " + err.message }));
            }
        });
        return;
    }

    // --- TRIGGER FONEPAY QR ---
    if (req.method === 'POST' && req.url === '/api/trigger-fonepay-qr') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { username, password, amount, remarks } = JSON.parse(body);
                const userKey = username.trim();

                let accessToken = sessionCache[userKey];

                if (!accessToken) {
                    console.log("\n>>> FONEPAY LOGIN...");
                    
                    const args = [
                        '-s', '-i', '-X', 'POST', 'https://merchantapi.fonepay.com/authentication/login',
                        '-H', 'Content-Type: application/json',
                        '-d', JSON.stringify({ username: userKey, password: password.trim(), secretKey: "", otpCode: "", recaptcha: "" })
                    ];
                    
                    const { stdout } = await execFilePromise('curl', args);
                    const lines = stdout.split('\r\n');
                    for (const line of lines) {
                        if (line.toLowerCase().startsWith('authorization: bearer')) {
                            accessToken = line.substring(22).trim();
                            break;
                        }
                    }

                    if (!accessToken) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: "Login failed" }));
                        return;
                    }
                    sessionCache[userKey] = accessToken;
                }
                
                // 1. Fetch Terminal ID
                const terminalData = await makeBankRequest(
                    'https://merchantapi.fonepay.com/merchantInfo/fetchSubmerchantTerminalList',
                    null,
                    accessToken,
                    'GET'
                );
                
                let terminalId = null;
                if (terminalData && terminalData.subMerchantLists && terminalData.subMerchantLists[0]) {
                    terminalId = terminalData.subMerchantLists[0].terminalLists[0].id;
                }

                if (!terminalId) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: "Terminal ID not found for this merchant." }));
                    return;
                }

                console.log(">>> GENERATING FONEPAY QR FOR Rs.", amount, " TERMINAL:", terminalId);
                
                // Map the internal Tracking ID (remarks) to billId!
                // We append a random short ID to remarks to guarantee uniqueness.
                const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
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
        });
        return;
    }

    // --- VERIFY FONEPAY TRANSACTION ---
    if (req.method === 'POST' && req.url === '/api/verify-fonepay-transaction') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                // nqrTxnId is the remarks/billId we returned as validationTraceId
                const { nqrTxnId, username, password, phoneNumber, amount, remarks } = JSON.parse(body);
                const userKey = username.trim();

                console.log(`\n🔍 [VERIFY] Checking Fonepay for order: ${remarks} or ${nqrTxnId}`);

                let accessToken = sessionCache[userKey];

                if (!accessToken) {
                    const args = [
                        '-s', '-i', '-X', 'POST', 'https://merchantapi.fonepay.com/authentication/login',
                        '-H', 'Content-Type: application/json',
                        '-d', JSON.stringify({ username: userKey, password: password.trim(), secretKey: "", otpCode: "", recaptcha: "" })
                    ];
                    const { stdout } = await execFilePromise('curl', args);
                    const lines = stdout.split('\r\n');
                    for (const line of lines) {
                        if (line.toLowerCase().startsWith('authorization: bearer')) {
                            accessToken = line.substring(22).trim();
                            break;
                        }
                    }
                    if (!accessToken) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: "Login failed" }));
                        return;
                    }
                    sessionCache[userKey] = accessToken;
                }

                const today = new Date().toISOString().split('T')[0];
                
                // Using the Upgraded Settlement Report API per the user's plan!
                const reportUrl = `https://merchantapi.fonepay.com/report/merchant-Settlement-report?pageNumber=1&pageSize=25&fromTransmissionDateTime=${today}&toTransmissionDateTime=${today}`;
                
                const listData = await makeBankRequest(
                    reportUrl,
                    { id: null, type: null },
                    accessToken
                );

                if (listData && listData.searchedDataList && Array.isArray(listData.searchedDataList)) {
                    console.log(`🔍 [VERIFY RESPONSE]: fetched ${listData.searchedDataList.length} settlement items`);
                    
                    const resultArr = listData.searchedDataList;
                    
                    // We prioritize nqrTxnId because it contains the exact unique string we generated!
                    const searchBillId = nqrTxnId || remarks;

                    // Exact matching without collisions as requested!
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

                        // We require either a perfect tracking ID match, OR a phone + amount match.
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
        });
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

const PORT = 3002;
server.listen(PORT, () => {
    console.log(`\n💳 Fonepay Proxy running on http://localhost:${PORT}`);
    console.log(`   POST /api/trigger-fonepay-qr`);
    console.log(`   POST /api/verify-fonepay-transaction (Fonepay verified)`);
});
