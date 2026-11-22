// Captures public Byiora Merchant Portal pages (docs + login) as mobile screenshots
// and a smooth-scroll recording of the docs page -> public/merchant/
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const OUT = path.resolve("public/merchant");
const TMP = path.resolve(".recording-tmp/merchant");
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(path.join(TMP, "frames"), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

for (const url of ["https://merchant.byiora.com.np/login", "https://www.byiora.com.np/merchant/login"]) {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    console.log("login url", url, "->", page.url());
    await sleep(1500);
    await page.screenshot({ path: path.join(OUT, "login.png") });
    break;
  } catch (e) { console.log("failed", url, e.message.split("\n")[0]); }
}

await page.goto("https://merchant.byiora.com.np/docs", { waitUntil: "networkidle", timeout: 30000 }).catch(async () => {
  await page.goto("https://www.byiora.com.np/merchant/docs", { waitUntil: "networkidle" });
});
console.log("docs url", page.url());
await sleep(1200);
await page.screenshot({ path: path.join(OUT, "docs-top.png") });
for (const id of ["overview", "before", "webhooks"]) {
  const el = page.locator(`#${id}`);
  if (await el.count()) {
    await el.scrollIntoViewIfNeeded();
    await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: "start" }), id);
    await sleep(600);
    await page.screenshot({ path: path.join(OUT, `docs-${id}.png`) });
  }
}
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(800);

// Smooth-scroll recording through the docs top + overview
const frames = [];
const cdp = await ctx.newCDPSession(page);
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const file = `f${String(frames.length).padStart(5, "0")}.jpg`;
  fs.writeFileSync(path.join(TMP, "frames", file), Buffer.from(data, "base64"));
  frames.push({ file, t: metadata.timestamp });
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
await sleep(1000);
const total = 2600, steps = 360;
let done = 0;
await page.mouse.move(195, 500);
for (let i = 1; i <= steps; i++) {
  const t = i / steps;
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const target = Math.round(total * e);
  await page.mouse.wheel(0, target - done);
  done = target;
  await sleep(16);
}
await sleep(1200);
await cdp.send("Page.stopScreencast");
await browser.close();

const lines = ["ffconcat version 1.0"];
for (let i = 0; i < frames.length; i++) {
  const dur = i + 1 < frames.length ? frames[i + 1].t - frames[i].t : 0.5;
  lines.push(`file 'frames/${frames[i].file}'`, `duration ${Math.max(dur, 0.001).toFixed(4)}`);
}
lines.push(`file 'frames/${frames[frames.length - 1].file}'`);
fs.writeFileSync(path.join(TMP, "list.txt"), lines.join(String.fromCharCode(10)));
execFileSync("npx", ["remotion", "ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", path.join(TMP, "list.txt"),
  "-vf", "scale=780:1688", "-r", "60", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "24", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", "-pix_fmt", "yuv420p",
  path.join(OUT, "docs-scroll.webm")], { stdio: "inherit", shell: true });
console.log("frames", frames.length);
