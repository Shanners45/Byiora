// Self-check: node --experimental-strip-types lib/merchant/kyc.check.ts
import assert from "node:assert"
// @ts-ignore -- Node strip-types needs the .ts extension; the app build does not.
import { sniffMime } from "./kyc.ts"

const b = (...x: number[]) => new Uint8Array([...x, 0, 0, 0, 0])
assert.equal(sniffMime(b(0x25, 0x50, 0x44, 0x46)), "application/pdf")
assert.equal(sniffMime(b(0x89, 0x50, 0x4e, 0x47)), "image/png")
assert.equal(sniffMime(b(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg")
assert.equal(sniffMime(b(0x3c, 0x73, 0x76, 0x67)), null) // "<svg": renamed HTML/SVG must be refused
assert.equal(sniffMime(b(0x4d, 0x5a, 0x90, 0x00)), null) // Windows .exe
assert.equal(sniffMime(new Uint8Array(0)), null)
console.log("kyc sniffMime: ok")
