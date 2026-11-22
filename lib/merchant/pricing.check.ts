// Self-check: node --experimental-strip-types lib/merchant/pricing.check.ts
import assert from "node:assert"
// @ts-ignore -- Node strip-types needs the .ts extension; the app build does not.
import { resolvePrice, ruleKey, type PriceRule } from "./pricing.ts"

const rule = (label: string, r: Partial<PriceRule>): [string, PriceRule] => [ruleKey("p", label), { product_id: "p", denomination_label: label, visible: null, discount_percent: null, fixed_price_paisa: null, ...r }]
const all = { discount_percent: 10, catalog_mode: "all" as const }
const sel = { discount_percent: 10, catalog_mode: "selected" as const }
const R = (...r: [string, PriceRule][]) => new Map(r)

// Merchant default discount
assert.deepEqual(resolvePrice(all, "p", "100", 10000, true, R()), { visible: true, pricePaisa: 9000, source: "merchant_discount" })
// Not enabled globally → hidden whatever the rules say
assert.equal(resolvePrice(all, "p", "100", 10000, false, R(rule("", { visible: true }))).visible, false)
// "selected" mode hides products without a visible rule
assert.equal(resolvePrice(sel, "p", "100", 10000, true, R()).visible, false)
assert.equal(resolvePrice(sel, "p", "100", 10000, true, R(rule("", { visible: true }))).visible, true)
// Hiding one amount, or the product
assert.equal(resolvePrice(all, "p", "100", 10000, true, R(rule("100", { visible: false }))).visible, false)
assert.equal(resolvePrice(all, "p", "100", 10000, true, R(rule("", { visible: false }))).visible, false)
// Price precedence: fixed > amount % > product % > merchant %
const rules = R(rule("", { discount_percent: 20 }), rule("100", { discount_percent: 5, fixed_price_paisa: 8888 }))
assert.deepEqual(resolvePrice(all, "p", "100", 10000, true, rules), { visible: true, pricePaisa: 8888, source: "fixed" })
assert.equal(resolvePrice(all, "p", "100", 10000, true, R(rule("", { discount_percent: 20 }), rule("100", { discount_percent: 5 }))).pricePaisa, 9500)
assert.equal(resolvePrice(all, "p", "200", 10000, true, rules).pricePaisa, 8000)
// Never below 1 paisa
assert.equal(resolvePrice({ discount_percent: 100, catalog_mode: "all" }, "p", "x", 50, true, R()).pricePaisa, 1)
console.log("merchant pricing: ok")
