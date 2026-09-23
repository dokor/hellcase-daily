import { access } from "node:fs/promises";
import { chromium, type BrowserContext } from "playwright";
import { config } from "./config.js";
import {
  assertNoPaidRequirement,
  findFreeDailyGiveaway,
  findJoinButton,
  isAlreadyJoined,
} from "./giveaways.js";
import {
  assertFreeNewbieCase,
  findOpenNewbieCaseButton,
  isNewbieCaseAlreadyOpened,
} from "./newbie.js";
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

async function runGiveaway(context: BrowserContext): Promise<string> {
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
      return `🎁 Giveaway: already joined — ${candidate.href}`;
    }

    const joinButton = await findJoinButton(page);
    if (!joinButton) {
      throw new Error(
        "Eligible giveaway found, but no visible join button was detected."
      );
    }

    if (config.dryRun) {
      return `🧪 Giveaway dry-run: would join ${candidate.href}`;
    }

    await joinButton.click();
    await page.waitForTimeout(1_500);

    if (!(await isAlreadyJoined(page))) {
      throw new Error(
        "Join button was clicked, but participation could not be confirmed."
      );
    }

    return `✅ Giveaway: joined successfully — ${candidate.href}`;
  } finally {
    await page.close();
  }
}

async function runNewbieCase(context: BrowserContext): Promise<string> {
  const page = await context.newPage();

  try {
    await page.goto(config.newbieCaseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    if (/login|signin|steam/i.test(page.url())) {
      throw new Error("Hellcase session appears to be expired.");
    }

    await assertFreeNewbieCase(page);

    if (await isNewbieCaseAlreadyOpened(page)) {
      return `📦 Newbie case: already opened today — ${config.newbieCaseUrl}`;
    }

    const openButton = await findOpenNewbieCaseButton(page);
    if (!openButton) {
      throw new Error(
        "Free newbie case page found, but no visible free open button was detected."
      );
    }

    if (config.dryRun) {
      return `🧪 Newbie case dry-run: would open ${config.newbieCaseUrl}`;
    }

    await openButton.click();
    await page.waitForTimeout(2_000);

    return `✅ Newbie case: open action triggered — ${config.newbieCaseUrl}`;
  } finally {
    await page.close();
  }
}

async function run(): Promise<void> {
  await ensureSessionExists();

  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({
    storageState: config.sessionPath,
  });

  try {
    const results: string[] = [];

    for (const task of [runGiveaway, runNewbieCase]) {
      try {
        results.push(await task(context));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push(`❌ ${message}`);
      }
    }

    if (!config.dryRun) {
      await context.storageState({ path: config.sessionPath });
    }

    await notify(results.join("\n"));
  } finally {
    await browser.close();
  }
}

run().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  await notify(`❌ Hellcase daily: ${message}`);
  process.exitCode = 1;
});
