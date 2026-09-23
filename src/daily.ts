import { access } from "node:fs/promises";
import { chromium } from "playwright";
import { config } from "./config.js";
import {
  assertNoPaidRequirement,
  findFreeDailyGiveaway,
  findJoinButton,
  isAlreadyJoined,
} from "./giveaways.js";
import { notify } from "./notify.js";

async function ensureSessionExists(): Promise<void> {
  try {
    await access(config.sessionPath);
  } catch {
    throw new Error(
      `Missing Hellcase session at ${config.sessionPath}. Run "npm run auth" first.`
    );
  }
}

async function run(): Promise<void> {
  await ensureSessionExists();

  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({
    storageState: config.sessionPath,
  });
  const page = await context.newPage();

  try {
    await page.goto(config.giveawaysUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    if (/login|signin|steam/i.test(page.url())) {
      throw new Error("Hellcase session appears to be expired.");
    }

    const candidate = await findFreeDailyGiveaway(page);
    if (!candidate) {
      throw new Error("No clearly identifiable free daily giveaway found.");
    }

    await page.goto(candidate.href, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    await assertNoPaidRequirement(page);

    if (await isAlreadyJoined(page)) {
      await notify(`🎁 Hellcase daily: already joined — ${candidate.href}`);
      return;
    }

    const joinButton = await findJoinButton(page);
    if (!joinButton) {
      throw new Error("Eligible giveaway found, but no visible join button was detected.");
    }

    if (config.dryRun) {
      await notify(
        `🧪 Hellcase daily dry-run: would join ${candidate.href}`
      );
      return;
    }

    await joinButton.click();
    await page.waitForTimeout(1_500);

    if (!(await isAlreadyJoined(page))) {
      throw new Error(
        "Join button was clicked, but participation could not be confirmed."
      );
    }

    await context.storageState({ path: config.sessionPath });
    await notify(`✅ Hellcase daily: joined successfully — ${candidate.href}`);
  } finally {
    await browser.close();
  }
}

run().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  await notify(`❌ Hellcase daily: ${message}`);
  process.exitCode = 1;
});
