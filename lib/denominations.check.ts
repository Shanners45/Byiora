// Self-check: node --experimental-strip-types lib/denominations.check.ts
import assert from "node:assert"
// @ts-ignore -- Node strip-types needs the .ts extension; the app build does not.
import { denomCategoryName, denomKey, findDenomination, packTitle } from "./denominations.ts"

const packs = [
  { id: "np-475", label: "475 VP", price: "784", categoryId: "nepal" },
  { id: "in-475", label: "475 VP", price: "699", categoryId: "india" },
  { id: "np-2575", label: "2575 VP", price: "3950", categoryId: "nepal" },
]

// By permanent id: always the exact pack, even when titles repeat.
assert.equal(findDenomination(packs, "in-475")?.price, "699")
assert.equal(findDenomination(packs, "np-475")?.price, "784")
// By title: only when unique in the product (case and spacing ignored).
assert.equal(findDenomination(packs, " 2575 vp ")?.id, "np-2575")
// A shared title never guesses a pack.
assert.equal(findDenomination(packs, "475 VP"), undefined)
// Unknown or empty keys find nothing.
assert.equal(findDenomination(packs, "999 VP"), undefined)
assert.equal(findDenomination(packs, ""), undefined)
assert.equal(findDenomination(null, "np-475"), undefined)
// Keys: id first, title only for packs saved before ids existed.
assert.equal(denomKey({ id: "np-475", label: "475 VP" }), "np-475")
assert.equal(denomKey({ label: "475 VP" }), "475 VP")
// Order snapshots: category name without flags; plain title when the pack has no category.
const cats = [{ id: "india", name: "\u{1F1EE}\u{1F1F3} India" }, { id: "nepal", name: "Nepal" }]
assert.equal(denomCategoryName(cats, packs[1]), "India")
assert.equal(denomCategoryName(cats, { categoryId: "gone" }), null)
assert.equal(denomCategoryName(null, packs[0]), null)
assert.equal(packTitle({ amount: "475 VP", denomination_category: "India" }), "475 VP · India")
assert.equal(packTitle({ amount: "50 Diamonds", denomination_category: "Diamonds" }), "50 Diamonds")
assert.equal(packTitle({ amount: "Rs 500" }), "Rs 500")
console.log("denominations: ok")
