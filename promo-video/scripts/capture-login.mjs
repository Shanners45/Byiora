import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto("https://merchant.byiora.com.np/login", { waitUntil: "load", timeout: 45000 });
await p.waitForTimeout(4000);
console.log(p.url());
await p.screenshot({ path: "public/merchant/login.png" });
await b.close();
