import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { config } from "./config.js";

await mkdir(dirname(config.sessionPath), { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

console.log("Opening Hellcase. Sign in manually, including Steam/2FA if required.");
await page.goto(config.giveawaysUrl, { waitUntil: "domcontentloaded" });

const rl = createInterface({ input, output });
await rl.question(
  "\nOnce Hellcase is fully connected in the opened browser, press Enter here to save the session..."
);
rl.close();

await context.storageState({ path: config.sessionPath });
console.log(`Session saved to ${config.sessionPath}`);

await browser.close();
