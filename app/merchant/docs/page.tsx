import type React from "react"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { CodeTabs, DocsToc, PrintButton } from "@/components/merchant/docs-code"

export const metadata: Metadata = {
  title: "Merchant API Documentation",
  description: "How to sell Byiora gift cards and game codes on your own website with the Byiora Merchant API.",
}

const BASE = "https://www.byiora.com.np/api/v1"

const TOC: [string, string][] = [
  ["overview", "1. How it works"],
  ["before", "2. Before you start"],
  ["auth", "3. API keys and authentication"],
  ["walkthrough", "4. Integration walkthrough"],
  ["skus", "4.1 SKUs and your own names"],
  ["lifecycle", "4.2 Order flow and failures"],
  ["balance", "5.1 Get balance"],
  ["products", "5.2 List products"],
  ["create-order", "5.3 Place an order"],
  ["get-order", "5.4 Get an order"],
  ["list-orders", "5.5 List orders"],
  ["errors", "6. Errors"],
  ["retries", "7. Retries and idempotency"],
  ["limits", "8. Rate and spending limits"],
  ["webhooks", "9. Webhooks"],
  ["test-mode", "10. Test mode"],
  ["security", "11. Security"],
  ["checklist", "12. Go-live checklist"],
  ["support", "13. Support"],
]

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-gray-200 pt-8 mt-8 first:border-0 first:pt-0 first:mt-0 break-inside-avoid-page">
      <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] mb-3">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-[#374151]">{children}</div>
    </section>
  )
}

function Endpoint({ method, path, id, title, children }: { method: "GET" | "POST"; path: string; id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-6 rounded-2xl border-2 border-[#F59E0B]/30 bg-[#FEF7E0]/40 p-4 sm:p-5 mt-6 break-inside-avoid-page">
      <h3 className="text-lg font-bold text-[#1F2937]">{title}</h3>
      <p className="mt-2 font-mono text-sm">
        <span className={`inline-block px-2 py-0.5 rounded-md text-white text-xs font-bold mr-2 ${method === "GET" ? "bg-emerald-600" : "bg-[#7E3AF2]"}`}>{method}</span>
        <span className="text-[#1F2937] break-all">{path}</span>
      </p>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[#374151]">{children}</div>
    </div>
  )
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white my-3 break-inside-avoid">
      <table className="w-full text-sm">
        <thead className="bg-[#FEF7E0]/60">
          <tr>{head.map((h) => <th key={h} className="text-left font-bold text-[#1F2937] px-3 py-2 whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">{r.map((c, j) => <td key={j} className="px-3 py-2 text-[#374151]">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Note({ tone = "info", children }: { tone?: "info" | "warn"; children: React.ReactNode }) {
  return <div className={`rounded-xl border-2 p-3.5 text-sm break-inside-avoid ${tone === "warn" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-purple-200 bg-purple-50 text-purple-900"}`}>{children}</div>
}

const C = ({ children }: { children: React.ReactNode }) => <code className="font-mono text-[13px] bg-gray-100 text-[#7E3AF2] px-1.5 py-0.5 rounded">{children}</code>

const ORDER_RESPONSE = `{
  "order_id": "7b0c2f1e-4a8d-4c3b-9a51-2f6d0e8b1c44",
  "client_ref": "ORDER-10045",
  "status": "COMPLETED",
  "livemode": true,
  "duplicate": false,
  "sku": "GOOGLE-PLAY-100INR",
  "merchant_sku": "MY-GPLAY-100",
  "display_name": "Google Play ₹100 (India)",
  "product_id": "google-play",
  "product_name": "Google Play Gift card (INR)",
  "denomination": "₹100 Gift Card",
  "quantity": 1,
  "unit_price": 190,
  "total": 190,
  "currency": "NPR",
  "customer": { "email": "sita@example.com", "name": "Sita Sharma", "phone": "+9779800000000" },
  "created_at": "2026-11-22T09:15:02.481Z",
  "codes": ["ABCD-EFGH-IJKL-MNOP"]
}`

export default function MerchantDocs() {
  return (
    <div className="min-h-screen bg-white print:bg-white">
      <header className="border-b border-gray-200 bg-white print:border-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Image src="https://www.byiora.com.np/logo-final.png" alt="Byiora" width={110} height={32} style={{ objectFit: "contain", width: "auto", height: 30 }} unoptimized priority />
            <span className="text-xs font-bold text-[#7E3AF2] uppercase tracking-wider">Merchant API</span>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Link href="/merchant/dashboard/api-keys" className="hidden sm:inline-flex h-10 items-center px-4 rounded-xl border border-gray-300 text-sm font-semibold text-[#1F2937] hover:bg-gray-50">Merchant portal</Link>
            <PrintButton />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:grid lg:grid-cols-[230px_1fr] lg:gap-10">
        <nav aria-label="Contents" className="hidden lg:block print:hidden">
          <DocsToc items={TOC} />
        </nav>

        <main className="min-w-0">
          <div className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1F2937]">Sell Byiora codes on your website</h1>
            <p className="mt-3 text-lg text-[#4B5563]">A step-by-step guide to the Byiora Merchant API: list our games and digital gift cards on your store, take payment your way, and deliver codes to your customers instantly.</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {["Version 1", "REST + JSON", "Prices in NPR", "Instant delivery", "Signed webhooks"].map((t) => <span key={t} className="px-2.5 py-1 rounded-full bg-[#FEF7E0] border border-[#F59E0B]/30 text-[#92400E] font-semibold">{t}</span>)}
            </div>
          </div>

          <Section id="overview" title="1. How it works">
            <p>Byiora is your wholesale supplier. You keep a prepaid <strong>wallet</strong> with us, and every code you buy is paid from it instantly. Your customers never see Byiora: they buy from your website at the price you choose.</p>
            <div className="grid sm:grid-cols-5 gap-2 my-4 text-center text-sm break-inside-avoid">
              {[
                ["1", "Customer picks a product on your site"],
                ["2", "Customer pays you (eSewa, Khalti, card…)"],
                ["3", "Your server calls POST /orders"],
                ["4", "Byiora returns the code in the same response"],
                ["5", "You show and email the code to the customer"],
              ].map(([n, t]) => (
                <div key={n} className="rounded-xl border-2 border-[#F59E0B]/30 bg-[#FEF7E0]/50 p-3">
                  <div className="mx-auto mb-1.5 h-7 w-7 rounded-full bg-[#7E3AF2] text-white font-bold flex items-center justify-center">{n}</div>
                  {t}
                </div>
              ))}
            </div>
            <p>Your profit is the difference between your selling price and your Byiora price. Orders complete synchronously: there is no waiting or polling for normal orders.</p>
          </Section>

          <Section id="before" title="2. Before you start">
            <Table
              head={["You need", "Where"]}
              rows={[
                ["A verified merchant account", "Merchant portal → Account (submit your business documents)"],
                ["Money in your wallet", "Merchant portal → Wallet → Add funds"],
                ["A test API key to build with", "Merchant portal → API Keys → Create key → Test key"],
                ["A live API key when you go live", "Same place, choose Live key (needs verification)"],
                ["Your server's public IP addresses", "Add them to the key's IP allowlist"],
              ]}
            />
            <Table
              head={["Setting", "Value"]}
              rows={[
                ["Base URL", <C key="b">{BASE}</C>],
                ["Format", "JSON request and response bodies, UTF-8"],
                ["Money", "Rupees as numbers with up to 2 decimals, e.g. 190 or 189.5 (currency NPR)"],
                ["Times", "ISO 8601 in UTC, e.g. 2026-11-22T09:15:02.481Z"],
                ["Transport", "HTTPS only (TLS 1.2+)"],
              ]}
            />
          </Section>

          <Section id="auth" title="3. API keys and authentication">
            <p>Send your secret key in the <C>Authorization</C> header on every request:</p>
            <CodeTabs samples={{ HTTP: "Authorization: Bearer byk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }} />
            <Table
              head={["Key type", "Starts with", "What it does"]}
              rows={[
                ["Live", <C key="l">byk_live_</C>, "Real orders, real codes, charged to your wallet."],
                ["Test", <C key="t">byk_test_</C>, "Same checks and prices, fake codes, never charged. See Test mode."],
              ]}
            />
            <Note tone="warn">Your key is shown once when you create it. Keep it on your server in an environment variable or secret manager. Never put it in a website, mobile app or Git repository. If it leaks, revoke it in the portal and create a new one.</Note>
            <p><strong>IP allowlist.</strong> If you list IP addresses on a key, requests from any other IP are refused with <C>403 IP_NOT_ALLOWED</C>. We strongly recommend it for live keys. Remember to add every outgoing IP your servers use, including failover servers.</p>
          </Section>

          <Section id="walkthrough" title="4. Integration walkthrough">
            <p>This is the recommended way to add Byiora products to an online store. The same steps work for any language or platform (WooCommerce, Shopify app, Laravel, Node, Django…).</p>

            <h3 className="text-lg font-bold text-[#1F2937] pt-2">Step 1. Sync the catalog</h3>
            <p>Call <C>GET /products</C> from your server every 10–15 minutes (and when your admin clicks &quot;refresh&quot;). Save each amount&apos;s <C>sku</C>: it permanently identifies what to order. The response also gives your price and current stock.</p>
            <CodeTabs
              title="Sync products"
              samples={{
                cURL: `curl ${BASE}/products \\\n  -H "Authorization: Bearer $BYIORA_API_KEY"`,
                "Node.js": `const res = await fetch("${BASE}/products", {
  headers: { Authorization: \`Bearer \${process.env.BYIORA_API_KEY}\` },
})
const { products } = await res.json()
for (const p of products) {
  for (const d of p.denominations) {
    // Save p.id + d.denomination, your cost d.price, and d.in_stock
    await db.upsertProduct({ byioraId: p.id, name: p.name, amount: d.denomination, cost: d.price, stock: d.in_stock })
  }
}`,
                PHP: `$ch = curl_init("${BASE}/products");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ["Authorization: Bearer " . getenv("BYIORA_API_KEY")],
]);
$data = json_decode(curl_exec($ch), true);
foreach ($data["products"] as $p) {
  foreach ($p["denominations"] as $d) {
    // Save $p["id"], $d["denomination"], $d["price"], $d["in_stock"]
  }
}`,
                Python: `import os, requests
r = requests.get("${BASE}/products",
                 headers={"Authorization": f"Bearer {os.environ['BYIORA_API_KEY']}"}, timeout=15)
for p in r.json()["products"]:
    for d in p["denominations"]:
        save_product(p["id"], p["name"], d["denomination"], cost=d["price"], stock=d["in_stock"])`,
              }}
            />

            <h3 className="text-lg font-bold text-[#1F2937] pt-2">Step 2. Show products with your own price</h3>
            <p>Display the products on your site at your selling price (your cost plus your margin). Hide or mark &quot;sold out&quot; any amount whose <C>in_stock</C> is 0. Never show your Byiora cost or API data in the browser.</p>

            <h3 className="text-lg font-bold text-[#1F2937] pt-2">Step 3. Take payment from your customer first</h3>
            <p>Use your own payment gateway. Only continue once the payment is <strong>confirmed on your server</strong> (for example by the gateway&apos;s server callback), never just because the customer returned to a &quot;success&quot; page.</p>

            <h3 className="text-lg font-bold text-[#1F2937] pt-2">Step 4. Place the order from your server</h3>
            <p>Create your own order ID <strong>before</strong> calling us and save it. Send it as <C>client_ref</C>. Include your customer&apos;s details and, to protect your margin, the highest unit price you&apos;re willing to pay as <C>max_unit_price</C>.</p>
            <CodeTabs
              title="Place an order"
              samples={{
                cURL: `curl -X POST ${BASE}/orders \\
  -H "Authorization: Bearer $BYIORA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "product_id": "google-play",
    "denomination": "₹100 Gift Card",
    "quantity": 1,
    "client_ref": "ORDER-10045",
    "max_unit_price": 200,
    "customer": { "email": "sita@example.com", "name": "Sita Sharma", "phone": "+9779800000000" }
  }'`,
                "Node.js": `async function buyFromByiora(order) {
  const res = await fetch("${BASE}/orders", {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.BYIORA_API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: order.byioraProductId,
      denomination: order.amount,
      quantity: order.quantity,
      client_ref: order.id,            // your own order ID, saved before this call
      max_unit_price: order.maxCost,   // optional margin protection
      customer: { email: order.email, name: order.name, phone: order.phone },
    }),
    signal: AbortSignal.timeout(30_000),
  })
  const body = await res.json()
  if (!res.ok) throw Object.assign(new Error(body.error.message), { code: body.error.code, status: res.status })
  return body // body.codes = ["..."]
}`,
                PHP: `function buy_from_byiora(array $order): array {
  $payload = json_encode([
    "product_id" => $order["byiora_product_id"],
    "denomination" => $order["amount"],
    "quantity" => $order["quantity"],
    "client_ref" => $order["id"],          // your own order ID
    "max_unit_price" => $order["max_cost"],
    "customer" => ["email" => $order["email"], "name" => $order["name"], "phone" => $order["phone"]],
  ]);
  $ch = curl_init("${BASE}/orders");
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer " . getenv("BYIORA_API_KEY"), "Content-Type: application/json"],
  ]);
  $body = json_decode(curl_exec($ch), true);
  $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  if ($status >= 400) throw new Exception($body["error"]["code"] . ": " . $body["error"]["message"]);
  return $body; // $body["codes"]
}`,
                Python: `def buy_from_byiora(order):
    r = requests.post(
        "${BASE}/orders",
        headers={"Authorization": f"Bearer {os.environ['BYIORA_API_KEY']}"},
        json={
            "product_id": order.byiora_product_id,
            "denomination": order.amount,
            "quantity": order.quantity,
            "client_ref": order.id,           # your own order ID
            "max_unit_price": order.max_cost,
            "customer": {"email": order.email, "name": order.name, "phone": order.phone},
        },
        timeout=30,
    )
    body = r.json()
    if r.status_code >= 400:
        raise ByioraError(body["error"]["code"], body["error"]["message"])
    return body  # body["codes"]`,
              }}
            />

            <h3 className="text-lg font-bold text-[#1F2937] pt-2">Step 5. Deliver the codes</h3>
            <p>Show the codes on your order confirmation page and email them to your customer. Store them encrypted in your database, and only show them to the customer who bought them.</p>
            <p>If the response has <C>&quot;status&quot;: &quot;PROCESSING&quot;</C> and an empty <C>codes</C> list, the order is paid and being prepared. Show your customer &quot;Processing&quot;, then deliver the codes when you receive the <C>order.completed</C> webhook (or when <C>GET /orders/ref:ORDER-10045</C> shows <C>COMPLETED</C>). Never place a second order for it.</p>

            <h3 className="text-lg font-bold text-[#1F2937] pt-2">Step 6. Handle problems</h3>
            <Table
              head={["What happened", "What to do"]}
              rows={[
                ["Timeout or network error", <>Send the <strong>same request again with the same client_ref</strong>. If we already completed it you get the same order back (with <C>&quot;duplicate&quot;: true</C>) and are not charged twice. Or call <C>GET /orders/ref:ORDER-10045</C>.</>],
                [<C key="o">409 OUT_OF_STOCK</C>, "Tell the customer it's temporarily unavailable and refund them, or retry later. Re-sync products to hide it."],
                [<C key="i">402 INSUFFICIENT_BALANCE</C>, "Top up your wallet. Set a low-balance alert in the portal so this doesn't surprise you."],
                [<C key="p">409 PRICE_CHANGED</C>, "Our price is above your max_unit_price. Re-sync prices and decide whether to continue."],
                [<C key="r">429 RATE_LIMITED</C>, <>Wait the number of seconds in the <C>Retry-After</C> header, then retry.</>],
              ]}
            />

            <h3 className="text-lg font-bold text-[#1F2937] pt-2">Step 7. Listen to webhooks (recommended)</h3>
            <p>Add a webhook URL in the portal to hear about refunds, top-ups and low balance automatically. See <a href="#webhooks" className="text-[#7E3AF2] font-semibold hover:underline">Webhooks</a>.</p>
          </Section>

          <Section id="skus" title="4.1 SKUs and your own product names">
            <p>Every product amount has a permanent <strong>Byiora SKU</strong>, for example <C>GOOGLE-PLAY-100INR</C> or <C>AMAZON-GIFT-CARD-5USD</C>. It never changes, so it is the best thing to store in your system. You get it from <C>GET /products</C> and can order with it directly:</p>
            <CodeTabs samples={{ "Order by SKU": `curl -X POST ${BASE}/orders \\\n  -H "Authorization: Bearer $BYIORA_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "sku": "GOOGLE-PLAY-100INR",\n    "quantity": 1,\n    "client_ref": "ORDER-10046",\n    "customer": { "email": "sita@example.com" }\n  }'` }} />
            <p><strong>Your own names.</strong> Your customers only ever see your website, so call products whatever you like there, for example &quot;Google Play ₹100 (India)&quot;. Just keep a link from your product to our SKU.</p>
            <p><strong>Your own SKUs (optional).</strong> If your store already has its own product codes, you can save them in the merchant portal (<em>Catalog</em> → tag icon next to an amount) together with an optional display name. Then:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><C>sku</C> in <C>POST /orders</C> accepts either our SKU or your own one.</li>
              <li><C>GET /products</C> shows your <C>merchant_sku</C> and <C>display_name</C> next to our <C>sku</C>.</li>
              <li>Order responses, webhooks, order history and CSV exports include both.</li>
            </ul>
            <Table
              head={["Way to order", "Send", "Notes"]}
              rows={[
                ["Byiora SKU (recommended)", <C key="a">{'"sku": "GOOGLE-PLAY-100INR"'}</C>, "Stable, assigned by us"],
                ["Your own SKU", <C key="b">{'"sku": "MY-GPLAY-100"'}</C>, "Only after you save it in the portal"],
                ["Product + amount", <C key="c">{'"product_id": "google-play", "denomination": "₹100 Gift Card"'}</C>, "Works, but the text must match exactly"],
              ]}
            />
          </Section>

          <Section id="lifecycle" title="4.2 Order flow and failure scenarios">
            <p>What happens on every order, in order. Each step either passes or stops the order <strong>before</strong> any money moves:</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li><strong>Key check</strong>: valid key, not revoked, request from an allowed IP.</li>
              <li><strong>Account check</strong>: account active and verified (test keys skip this).</li>
              <li><strong>Rate limit</strong>: within your requests-per-minute.</li>
              <li><strong>Request check</strong>: all fields valid, product and amount available to you.</li>
              <li><strong>Duplicate check</strong>: if this <C>client_ref</C> was already used, you get that order back and nothing else happens.</li>
              <li><strong>Price check</strong>: our price is at or below your <C>max_unit_price</C> (if you sent one).</li>
              <li><strong>Limit check</strong>: within your per-order, 24-hour and 30-day spending limits.</li>
              <li><strong>Balance check</strong>: enough available balance (wallet + any credit).</li>
              <li><strong>Stock check</strong>: enough codes for the full quantity (never a partial order).</li>
              <li><strong>Complete</strong>: in one step we reserve the codes, take the money from your wallet and record the order. Then we return the codes and send an <C>order.completed</C> webhook.</li>
            </ol>
            <p>Steps 5–10 run together in one database transaction: either all of it happens or none of it does. You are never charged without getting codes, and never get codes without being charged.</p>
            <Table
              head={["Scenario", "What you get back", "Charged?", "What you should do"]}
              rows={[
                ["Order succeeds", "201 with codes", "Yes, once", "Show and email the codes to your customer"],
                ["Same client_ref sent again", "200 with the same order and codes, duplicate: true", "No (already charged once)", "Nothing: this is how safe retries work"],
                ["Your request times out / connection drops", "Nothing", "Maybe", <>Retry with the same <C key="1">client_ref</C>, or call <C key="2">GET /orders/ref:…</C>. You&apos;ll never be charged twice.</>],
                ["Not enough balance", "402 INSUFFICIENT_BALANCE", "No", "Top up, then retry the same request"],
                ["Not enough stock", "409 OUT_OF_STOCK", "No", "Refund your customer or try later; re-sync products"],
                ["Our price went up above your limit", "409 PRICE_CHANGED", "No", "Re-sync prices, then decide"],
                ["Over a spending limit", "403 ORDER_LIMIT / DAILY_LIMIT / MONTHLY_LIMIT", "No", "Wait for the window to pass or ask us for a higher limit"],
                ["Product hidden or removed", "404 PRODUCT_NOT_FOUND / SKU_NOT_FOUND", "No", "Remove it from your store"],
                ["Too many requests", "429 RATE_LIMITED + Retry-After", "No", "Wait, then retry"],
                ["Account suspended or key revoked", "403 / 401", "No", "Contact support"],
                ["Our server error", "500 ORDER_FAILED", "No", "Retry with the same client_ref"],
                ["A code doesn't work for your customer", "-", "Already charged", <>Open a ticket in the portal&apos;s Support page with the order ID. If we refund it, the money returns to your wallet and you get an <C key="3">order.refunded</C> webhook.</>],
              ]}
            />
            <Note>Your customer pays <strong>you</strong>, and you pay <strong>us</strong> from your wallet. If we can&apos;t deliver (out of stock, limits, balance), refunding your customer is between you and your customer; you were never charged by us for that order.</Note>
          </Section>

          <Section id="reference" title="5. API reference">
            <p>All endpoints are under <C>{BASE}</C> and need the <C>Authorization</C> header.</p>

            <Endpoint method="GET" path="/balance" id="balance" title="5.1 Get balance">
              <p>What you can spend right now.</p>
              <CodeTabs samples={{ Response: `{\n  "livemode": true,\n  "currency": "NPR",\n  "balance": 4960,\n  "credit_limit": 0,\n  "available": 4960\n}` }} />
              <Table head={["Field", "Meaning"]} rows={[["balance", "Money in your wallet"], ["credit_limit", "Extra credit Byiora allows you (if any)"], ["available", "balance + credit_limit: the most you can spend now"]]} />
            </Endpoint>

            <Endpoint method="GET" path="/products" id="products" title="5.2 List products">
              <p>Every product and amount available to your account, with your price and live stock.</p>
              <CodeTabs samples={{ Response: `{\n  "currency": "NPR",\n  "products": [\n    {\n      "id": "google-play",\n      "name": "Google Play Gift card (INR)",\n      "category": "digital-goods",\n      "denominations": [\n        { "sku": "GOOGLE-PLAY-100INR", "denomination": "₹100 Gift Card", "merchant_sku": "MY-GPLAY-100", "display_name": "Google Play ₹100 (India)", "price": 190, "in_stock": 42 },\n        { "sku": "GOOGLE-PLAY-500INR", "denomination": "₹500 Gift Card", "merchant_sku": null, "display_name": null, "price": 930, "in_stock": 0 }\n      ]\n    }\n  ]\n}` }} />
              <Table head={["Field", "Meaning"]} rows={[["id", "Product ID: send as product_id"], ["denominations[].sku", "Byiora's permanent SKU: store this and order with it"], ["denominations[].denomination", "Amount name (or send as denomination)"], ["denominations[].merchant_sku / display_name", "Your own code and name, if you set them (else null)"], ["denominations[].price", "Your unit price in NPR"], ["denominations[].in_stock", "Codes available now"]]} />
            </Endpoint>

            <Endpoint method="POST" path="/orders" id="create-order" title="5.3 Place an order">
              <p>Buys codes and returns them immediately. Returns <C>201</C> for a new order and <C>200</C> when the same <C>client_ref</C> was already used (no new charge).</p>
              <Table
                head={["Field", "Type", "Required", "Description"]}
                rows={[
                  ["sku", "string", "Either this…", "Byiora SKU from GET /products, or your own SKU"],
                  ["product_id", "string", "…or these two", "From GET /products"],
                  ["denomination", "string", "…or these two", "Exact denomination text from GET /products"],
                  ["quantity", "integer", "No (1)", "1 to 20 codes"],
                  ["client_ref", "string", "Yes", "Your unique order ID: 4–64 letters, digits, _ or -. Reuse it on retries."],
                  ["max_unit_price", "number", "No", "Fail with PRICE_CHANGED instead of paying more than this per code"],
                  ["customer.email", "string", "Yes", "Your end customer's email"],
                  ["customer.name", "string", "No", "Up to 100 characters"],
                  ["customer.phone", "string", "No", "E.g. +9779800000000"],
                ]}
              />
              <Note>Unknown fields are rejected with <C>422 UNKNOWN_FIELD</C>, so typos are caught instead of silently ignored.</Note>
              <CodeTabs samples={{ Response: ORDER_RESPONSE }} />
            </Endpoint>

            <Endpoint method="GET" path="/orders/{order_id}  or  /orders/ref:{client_ref}" id="get-order" title="5.4 Get an order">
              <p>Fetch one order, including its codes. Use your own reference when you don&apos;t have our <C>order_id</C> (for example after a timeout).</p>
              <CodeTabs samples={{ cURL: `curl ${BASE}/orders/ref:ORDER-10045 \\\n  -H "Authorization: Bearer $BYIORA_API_KEY"` }} />
              <p>Returns the same shape as <a href="#create-order" className="text-[#7E3AF2] font-semibold hover:underline">Place an order</a>. The <C>status</C> is one of:</p>
              <Table
                head={["status", "Meaning", "Show your customer"]}
                rows={[
                  ["COMPLETED", "Codes are included in codes", "The codes"],
                  ["PROCESSING", "Paid and being prepared; codes is empty for now", <>&quot;Processing&quot;. We send <C key="w">order.completed</C> when the codes are ready, then fetch them here.</>],
                  ["REFUNDED", "Money is back in your wallet; no codes", "Cancelled / refunded"],
                ]}
              />
            </Endpoint>

            <Endpoint method="GET" path="/orders?page=1" id="list-orders" title="5.5 List orders">
              <p>Your API orders, newest first, 50 per page. Codes are not included; fetch a single order for them.</p>
              <CodeTabs samples={{ Response: `{\n  "livemode": true,\n  "page": 1,\n  "per_page": 50,\n  "total": 128,\n  "orders": [ { "order_id": "…", "client_ref": "ORDER-10045", "status": "COMPLETED", "total": 190, "…": "…" } ]\n}` }} />
            </Endpoint>
          </Section>

          <Section id="errors" title="6. Errors">
            <p>Errors use normal HTTP status codes and always have this body. Branch on <C>error.code</C>, not on the message text.</p>
            <CodeTabs samples={{ Response: `{\n  "error": {\n    "code": "INSUFFICIENT_BALANCE",\n    "message": "Not enough wallet balance. Top up your wallet first."\n  }\n}` }} />
            <Table
              head={["HTTP", "code", "Meaning", "Retry?"]}
              rows={[
                ["400", "INVALID_JSON", "Body isn't valid JSON", "No, fix the request"],
                ["401", "UNAUTHORIZED", "Missing, wrong or revoked key", "No"],
                ["402", "INSUFFICIENT_BALANCE", "Not enough available balance", "After topping up"],
                ["403", "IP_NOT_ALLOWED", "Request IP isn't on the key's allowlist", "No"],
                ["403", "KYC_REQUIRED / ACCOUNT_SUSPENDED", "Account can't order right now", "No, contact us"],
                ["403", "ORDER_LIMIT / DAILY_LIMIT / MONTHLY_LIMIT", "Over a spending limit on your account", "Later, or ask for a higher limit"],
                ["404", "PRODUCT_NOT_FOUND / ORDER_NOT_FOUND / SKU_NOT_FOUND", "Wrong product, amount, order or SKU", "No"],
                ["409", "OUT_OF_STOCK", "Not enough codes right now", "Later"],
                ["409", "PRICE_CHANGED", "Price is above your max_unit_price", "After re-syncing prices"],
                ["422", "INVALID_* / UNKNOWN_FIELD / INVALID_CUSTOMER", "A field is missing or wrong", "No, fix the request"],
                ["429", "RATE_LIMITED", "Too many requests", "Yes, after Retry-After seconds"],
                ["500", "ORDER_FAILED", "Unexpected error; you were not charged", "Yes, same client_ref"],
              ]}
            />
          </Section>

          <Section id="retries" title="7. Retries and idempotency">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Every order needs a <C>client_ref</C> that is unique in your system. Generate and save it <strong>before</strong> sending the request.</li>
              <li>If a request times out or the connection drops, send <strong>exactly the same request again</strong> with the same <C>client_ref</C>. You&apos;ll get the original order back and won&apos;t be charged twice.</li>
              <li>Never create a new <C>client_ref</C> for a retry of the same customer order. That would buy a second code.</li>
              <li>Retry only network errors, <C>429</C> and <C>5xx</C>. Use a short backoff (for example 1 s, 3 s, 10 s).</li>
            </ul>
          </Section>

          <Section id="limits" title="8. Rate and spending limits">
            <p><strong>Rate limit.</strong> Each account has a requests-per-minute limit shared by all its keys (shown in the portal under API Keys, 60 per minute by default). Above it you get <C>429 RATE_LIMITED</C> with a <C>Retry-After</C> header. Cache <C>GET /products</C> instead of calling it for every page view.</p>
            <p><strong>Spending limits.</strong> Byiora may set a maximum per order, per 24 hours and per 30 days on your account to protect you if a key leaks. You can see yours in the portal under Wallet. Orders over a limit return <C>403</C> with <C>ORDER_LIMIT</C>, <C>DAILY_LIMIT</C> or <C>MONTHLY_LIMIT</C>.</p>
          </Section>

          <Section id="webhooks" title="9. Webhooks">
            <p>Webhooks let us tell your server when something happens, instead of you checking. They are optional: orders already return codes immediately, so you only need webhooks for things that happen later (refunds, top-ups, low balance).</p>
            <h3 className="text-lg font-bold text-[#1F2937] pt-2">Set up in 5 steps</h3>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li><strong>Create an endpoint on your server</strong>, for example <C>https://your-store.com/byiora/webhook</C>, that accepts <C>POST</C> requests with a JSON body. It must be public HTTPS (no localhost, private IPs or self-signed certificates).</li>
              <li><strong>Save the URL</strong> in the merchant portal: <em>API Keys → Webhooks</em> → paste the URL → <em>Save</em>.</li>
              <li><strong>Copy the signing secret</strong> (<C>whsec_…</C>) shown right after saving. It is shown only once; store it on your server as <C>BYIORA_WEBHOOK_SECRET</C>. Lost it? Click <em>New signing secret</em> (the old one stops working immediately).</li>
              <li><strong>Verify every request</strong> with the code below before trusting it.</li>
              <li><strong>Click &quot;Send test event&quot;</strong> and check <em>Recent deliveries</em>. You should see <C>webhook.test</C> marked <em>delivered</em>. Failed ones show the HTTP status or error and have a <em>Retry</em> button.</li>
            </ol>
            <p>To turn webhooks off, clear the URL and save.</p>
            <Table
              head={["Event", "When"]}
              rows={[
                [<C key="1">order.completed</C>, "An order was completed (dashboard or API)"],
                [<C key="2">order.refunded</C>, "Byiora refunded an order to your wallet"],
                [<C key="3">wallet.credited</C>, "Money was added to your wallet (top-up or adjustment)"],
                [<C key="4">wallet.low_balance</C>, "Available balance dropped below your alert level"],
                [<C key="5">webhook.test</C>, "You pressed “Send test event”"],
              ]}
            />
            <CodeTabs samples={{ "Example body": `{\n  "id": "3f1c9a5e-0b7d-4e21-9a3c-1d2e4f6a8b90",\n  "type": "order.refunded",\n  "livemode": true,\n  "created_at": "2026-11-22T10:02:11.000Z",\n  "data": {\n    "order_id": "7b0c2f1e-4a8d-4c3b-9a51-2f6d0e8b1c44",\n    "client_ref": "ORDER-10045",\n    "status": "REFUNDED",\n    "total": 190,\n    "currency": "NPR",\n    "refund_reason": "Code did not work"\n  }\n}` }} />
            <Table
              head={["Header", "Value"]}
              rows={[
                [<C key="a">X-Byiora-Event</C>, "The event type"],
                [<C key="b">X-Byiora-Delivery</C>, "Unique ID of this event (same as body id); use it to ignore duplicates"],
                [<C key="c">X-Byiora-Timestamp</C>, "Unix time in seconds when it was signed"],
                [<C key="d">X-Byiora-Signature</C>, <><C>sha256=</C> + HMAC-SHA256 of <C>timestamp + &quot;.&quot; + raw body</C> using your signing secret</>],
              ]}
            />
            <p><strong>Always verify the signature</strong> using the raw request body (before JSON parsing) and reject timestamps older than 5 minutes:</p>
            <CodeTabs
              title="Verify a webhook"
              samples={{
                "Node.js": `import crypto from "crypto"
import express from "express"

const app = express()
app.post("/byiora/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const ts = req.header("X-Byiora-Timestamp")
  const sig = (req.header("X-Byiora-Signature") || "").replace("sha256=", "")
  const expected = crypto.createHmac("sha256", process.env.BYIORA_WEBHOOK_SECRET)
    .update(\`\${ts}.\${req.body}\`).digest("hex")
  const fresh = Math.abs(Date.now() / 1000 - Number(ts)) < 300
  if (!fresh || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return res.sendStatus(400)
  }
  const event = JSON.parse(req.body)
  // Ignore event.id if you've already processed it, then handle event.type
  res.sendStatus(200)
})`,
                PHP: `$raw = file_get_contents("php://input");
$ts = $_SERVER["HTTP_X_BYIORA_TIMESTAMP"] ?? "";
$sig = str_replace("sha256=", "", $_SERVER["HTTP_X_BYIORA_SIGNATURE"] ?? "");
$expected = hash_hmac("sha256", $ts . "." . $raw, getenv("BYIORA_WEBHOOK_SECRET"));
if (abs(time() - (int)$ts) > 300 || !hash_equals($expected, $sig)) {
  http_response_code(400);
  exit;
}
$event = json_decode($raw, true);
// Ignore $event["id"] if already processed, then handle $event["type"]
http_response_code(200);`,
                Python: `import hmac, hashlib, os, time
from flask import Flask, request, abort

app = Flask(__name__)

@app.post("/byiora/webhook")
def byiora_webhook():
    raw = request.get_data()
    ts = request.headers.get("X-Byiora-Timestamp", "")
    sig = request.headers.get("X-Byiora-Signature", "").replace("sha256=", "")
    expected = hmac.new(os.environ["BYIORA_WEBHOOK_SECRET"].encode(), f"{ts}.".encode() + raw, hashlib.sha256).hexdigest()
    if abs(time.time() - int(ts or 0)) > 300 or not hmac.compare_digest(expected, sig):
        abort(400)
    event = request.get_json()
    # Ignore event["id"] if already processed, then handle event["type"]
    return "", 200`,
              }}
            />
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Answer with any <C>2xx</C> within 10 seconds. Do slow work after responding.</li>
              <li>If your endpoint fails or times out, we retry with increasing delays for about a day. You can also retry a delivery from the portal.</li>
              <li>The same event can arrive more than once; use its <C>id</C> to process it only once.</li>
            </ul>
          </Section>

          <Section id="test-mode" title="10. Test mode">
            <p>Create a <strong>test key</strong> (<C>byk_test_…</C>) to build and test your integration, even before your account is verified.</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Same URLs, validation, prices and error codes as live.</li>
              <li>Orders return fake codes like <C>TEST-7B0C2F1E-01</C>. Nothing is charged and no real stock is used.</li>
              <li><C>GET /balance</C> shows a virtual Rs. 1,00,000.</li>
              <li>Responses include <C>&quot;livemode&quot;: false</C>; webhooks for test orders also have <C>livemode: false</C>.</li>
              <li>Test and live orders are completely separate: a test key can&apos;t see live orders and the other way round.</li>
            </ul>
          </Section>

          <Section id="security" title="11. Security">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Call the API only from your server. Browsers and mobile apps must talk to your server, never to Byiora directly.</li>
              <li>Keep keys and the webhook secret in a secret manager or environment variables, not in code.</li>
              <li>Use an IP allowlist on live keys, one key per server or environment, and revoke keys you no longer use.</li>
              <li>Only place an order after your payment provider has confirmed the payment on your server.</li>
              <li>Treat codes like cash: store them encrypted, show them only to the buyer, and never log them.</li>
              <li>Turn on two-factor sign-in for your merchant portal account.</li>
            </ul>
          </Section>

          <Section id="checklist" title="12. Go-live checklist">
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                "Business verified and wallet topped up",
                "Low-balance alert set in Wallet",
                "Live key stored in a secret manager",
                "IP allowlist on the live key, with all outgoing IPs",
                "client_ref saved before every order request",
                "Retries reuse the same client_ref",
                "Orders placed only after confirmed payment",
                "Catalog synced on a schedule; out-of-stock amounts hidden",
                "max_unit_price sent to protect your margin",
                "Webhook endpoint verifies signatures and ignores duplicates",
                "Codes shown and emailed only to the buyer",
                "Tested the whole flow end to end with a test key",
              ].map((t) => (
                <label key={t} className="flex items-start gap-2.5 rounded-lg border border-gray-200 p-3 text-sm break-inside-avoid">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#7E3AF2]" />
                  {t}
                </label>
              ))}
            </div>
          </Section>

          <Section id="support" title="13. Support">
            <p>Open a ticket from the <strong>Support</strong> page in the merchant portal (best for order, refund and limit questions; you&apos;ll see our replies there), or email <a href="mailto:support@byiora.com.np" className="text-[#7E3AF2] font-semibold hover:underline">support@byiora.com.np</a> with your merchant email, the <C>order_id</C> or <C>client_ref</C>, and the time of the request. Never send us your API key or webhook secret.</p>
          </Section>

          <p className="mt-12 pt-6 border-t border-gray-200 text-xs text-[#6B7280]">© {new Date().getFullYear()} Byiora. Merchant API v1.</p>
        </main>
      </div>
    </div>
  )
}
