// Records the Steam Gift Card purchase flow on byiora.com.np.
// Usage: node scripts/record.mjs          -> full run, reaches checkout QR (creates ONE real pending order)
//        node scripts/record.mjs --dry    -> stops before "Proceed to Payment" (no order created)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const OUT_DIR = path.resolve("public");
const TMP_DIR = path.resolve(".recording-tmp");
const VW = 390, VH = 844;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fake cursor (headless has none): a fingertip dot that follows the mouse and pulses on click.
const cursorScript = () => {
  const install = () => {
    if (document.getElementById("__pw_cursor")) return;
    const c = document.createElement("div");
    c.id = "__pw_cursor";
    Object.assign(c.style, {
      position: "fixed", left: "0px", top: "0px", width: "26px", height: "26px",
      marginLeft: "-13px", marginTop: "-13px", borderRadius: "50%",
      background: "rgba(255,215,0,0.55)", border: "3px solid #F59E0B",
      boxShadow: "0 0 12px rgba(245,158,11,0.8)", zIndex: "2147483647",
      pointerEvents: "none", transition: "transform 120ms ease-out",
      left: window.__cx ?? "195px", top: window.__cy ?? "600px",
    });
    document.documentElement.appendChild(c);
  };
  document.addEventListener("mousemove", (e) => {
    install();
    const c = document.getElementById("__pw_cursor");
    window.__cx = e.clientX + "px"; window.__cy = e.clientY + "px";
    c.style.left = window.__cx; c.style.top = window.__cy;
  }, true);
  document.addEventListener("mousedown", () => {
    const c = document.getElementById("__pw_cursor"); if (c) c.style.transform = "scale(0.6)";
  }, true);
  document.addEventListener("mouseup", () => {
    const c = document.getElementById("__pw_cursor"); if (c) c.style.transform = "scale(1)";
  }, true);
  if (document.readyState !== "loading") install(); else document.addEventListener("DOMContentLoaded", install);
};

let mx = VW / 2, my = VH * 0.7;
async function moveTo(page, x, y, ms = 700) {
  const steps = Math.max(12, Math.round(ms / 16));
  const sx = mx, sy = my;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
    await page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e);
    await sleep(16);
  }
  mx = x; my = y;
}
async function clickLocator(page, loc, pause = 350) {
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.boundingBox();
  await moveTo(page, box.x + box.width / 2, box.y + box.height / 2);
  await sleep(pause);
  await page.mouse.down(); await sleep(90); await page.mouse.up();
}
async function smoothScroll(page, dy, ms = 1500) {
  const steps = Math.round(ms / 16);
  let done = 0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const target = Math.round(dy * e);
    await page.mouse.wheel(0, target - done);
    done = target;
    await sleep(16);
  }
}
// Scroll so that element sits roughly at a given fraction of the viewport, smoothly.
async function scrollToEl(page, loc, frac = 0.35, ms = 1200) {
  const box = await loc.boundingBox();
  const dy = box.y - VH * frac;
  if (Math.abs(dy) > 10) await smoothScroll(page, dy, ms);
  await sleep(250);
}

fs.rmSync(TMP_DIR, { recursive: true, force: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: VW, height: VH },
  deviceScaleFactor: 2,
  locale: "en-US",
});
await context.addInitScript(cursorScript);
const page = await context.newPage();

await page.goto("https://www.byiora.com.np/", { waitUntil: "networkidle" });
await page.mouse.move(mx, my);

// CDP screencast at device pixel ratio 2 -> sharp 780x1688 frames with timestamps.
fs.mkdirSync(path.join(TMP_DIR, "frames"), { recursive: true });
const frames = [];
const cdp = await context.newCDPSession(page);
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const file = `f${String(frames.length).padStart(5, "0")}.jpg`;
  fs.writeFileSync(path.join(TMP_DIR, "frames", file), Buffer.from(data, "base64"));
  frames.push({ file, t: metadata.timestamp });
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: VW * 2, maxHeight: VH * 2, everyNthFrame: 1 });
await sleep(1500);

// 1. Browse homepage
await smoothScroll(page, 900, 1800);
await sleep(700);
await smoothScroll(page, 700, 1400);
await sleep(600);
await smoothScroll(page, -1600, 1600);
await sleep(600);

// 2. Open Steam Gift Card
const steam = page.locator('a[href="/en-np/steam-gift-card"]').first();
await scrollToEl(page, steam, 0.4);
await sleep(400);
await Promise.all([page.waitForURL(/steam-gift-card/), clickLocator(page, steam, 500)]);
await page.waitForLoadState("networkidle");
await sleep(1500);

// 3. Select Rs. 450
const voucher = page.getByText("Rs. 450", { exact: true }).first();
await scrollToEl(page, voucher, 0.45);
await clickLocator(page, voucher, 400);
await sleep(1200);

// 4. Email
const email = page.getByPlaceholder("Enter your email address");
await scrollToEl(page, email, 0.4);
await clickLocator(page, email, 300);
await sleep(300);
await page.keyboard.type("demo@byiora.com.np", { delay: 85 });
await sleep(900);

// 5. Payment method + proceed
const fonepay = page.getByText("Fonepay", { exact: true }).first();
if (await fonepay.count()) {
  await scrollToEl(page, fonepay, 0.45);
  await clickLocator(page, fonepay, 300);
  await sleep(900);
}
const proceed = page.getByRole("button", { name: "Proceed to Payment" });
await proceed.scrollIntoViewIfNeeded();
{ const b = await proceed.boundingBox(); await moveTo(page, b.x + b.width / 2, b.y + b.height / 2); } // hover only, no click
await sleep(500);
if (DRY) {
  console.log("DRY run: stopping before Proceed to Payment");
  await sleep(1500);
} else {
  await page.mouse.down(); await sleep(90); await page.mouse.up(); // single real click
  await page.waitForURL(/\/checkout\//, { timeout: 60000, waitUntil: "commit" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(2500);
  // Check for any captcha challenge
  const html = await page.content();
  if (/cf-challenge|turnstile|captcha/i.test(html)) console.log("WARNING: captcha marker found on checkout page");
  await page.screenshot({ path: path.join(TMP_DIR, "checkout.png") });
  await smoothScroll(page, 250, 1000);
  await sleep(2500);
}

await cdp.send("Page.stopScreencast").catch(() => {});
const finalUrl = page.url();
await context.close();
await browser.close();

// Build an ffconcat list using real frame timestamps, then encode constant 60fps webm.
const lines = ["ffconcat version 1.0"];
for (let i = 0; i < frames.length; i++) {
  const dur = i + 1 < frames.length ? frames[i + 1].t - frames[i].t : 1.0;
  lines.push(`file 'frames/${frames[i].file}'`, `duration ${Math.max(dur, 0.001).toFixed(4)}`);
}
lines.push(`file 'frames/${frames[frames.length - 1].file}'`);
fs.writeFileSync(path.join(TMP_DIR, "list.txt"), lines.join(String.fromCharCode(10)));
fs.mkdirSync(OUT_DIR, { recursive: true });
const dest = path.join(OUT_DIR, DRY ? "demo-dry.webm" : "demo.webm");
const { execFileSync } = await import("node:child_process");
execFileSync("npx", ["remotion", "ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", path.join(TMP_DIR, "list.txt"),
  "-vf", "scale=780:1688", "-r", "60", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "24", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", "-pix_fmt", "yuv420p", dest],
  { stdio: "inherit", shell: true });
console.log("frames", frames.length, "saved", dest, "url", finalUrl);
