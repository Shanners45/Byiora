import { chromium, devices } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices["iPhone 13"].userAgent });
const p = await ctx.newPage();
await p.goto("https://www.byiora.com.np/", { waitUntil: "networkidle" });
const links = await p.$$eval("a", as => as.map(a => [a.textContent.trim().slice(0,40), a.getAttribute("href")]).filter(x => /steam/i.test(x.join(" "))));
console.log(links);
console.log("height", await p.evaluate(() => document.body.scrollHeight));
await p.screenshot({ path: process.argv[2] + "/home.png" });
const href = links[0]?.[1];
if (href) {
  await p.goto(new URL(href, "https://www.byiora.com.np").href, { waitUntil: "networkidle" });
  console.log(p.url());
  await p.screenshot({ path: process.argv[2] + "/product.png", fullPage: true });
  const btns = await p.$$eval("button, input", els => els.map(e => [e.tagName, (e.textContent||"").trim().slice(0,50), e.getAttribute("type"), e.getAttribute("placeholder"), e.getAttribute("name")]));
  console.log(JSON.stringify(btns, null, 0));
}
await b.close();
