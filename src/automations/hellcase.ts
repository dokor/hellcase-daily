import type { BrowserContext } from "playwright";
import { createPersistedBrowser } from "../browser.js";
import { config } from "../config.js";
import {
  assertNoPaidRequirement,
  findFreeDailyGiveaway,
  findJoinButton,
  isAlreadyJoined,
} from "../giveaways.js";
import {
  assertFreeNewbieCase,
  findOpenNewbieCaseButton,
  isNewbieCaseAlreadyOpened,
} from "../newbie.js";
import type {
  AutomationDefinition,
  AutomationRunResult,
} from "./types.js";

type TaskResult = {
  ok: boolean;
  message: string;
};

async function runGiveaway(context: BrowserContext): Promise<TaskResult> {
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
      return {
        ok: true,
        message: "🎁 Giveaway: already joined — " + candidate.href,
      };
    }

    const joinButton = await findJoinButton(page);
    if (!joinButton) {
      throw new Error(
        "Eligible giveaway found, but no visible join button was detected."
      );
    }

    if (config.dryRun) {
      return {
        ok: true,
        message: "🧪 Giveaway dry-run: would join " + candidate.href,
      };
    }

    await joinButton.click();
    await page.waitForTimeout(1_500);

    if (!(await isAlreadyJoined(page))) {
      throw new Error(
        "Join button was clicked, but participation could not be confirmed."
      );
    }

    return {
      ok: true,
      message: "✅ Giveaway: joined successfully — " + candidate.href,
    };
  } finally {
    await page.close();
  }
}

async function runNewbieCase(context: BrowserContext): Promise<TaskResult> {
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
      return {
        ok: true,
        message:
          "📦 Newbie case: already opened today — " + config.newbieCaseUrl,
      };
    }

    const openButton = await findOpenNewbieCaseButton(page);
    if (!openButton) {
      throw new Error(
        "Free newbie case page found, but no visible free open button was detected."
      );
    }

    if (config.dryRun) {
      return {
        ok: true,
        message: "🧪 Newbie case dry-run: would open " + config.newbieCaseUrl,
      };
    }

    await openButton.click();
    await page.waitForTimeout(2_000);

    return {
      ok: true,
      message:
        "✅ Newbie case: open action triggered — " + config.newbieCaseUrl,
    };
  } finally {
    await page.close();
  }
}

async function runHellcaseDaily(): Promise<AutomationRunResult> {
  const { browser, context } = await createPersistedBrowser(
    config.sessionPath,
    config.headless
  );

  try {
    const tasks = [runGiveaway, runNewbieCase];
    const results: TaskResult[] = [];

    for (const task of tasks) {
      try {
        results.push(await task(context));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ ok: false, message: "❌ " + message });
      }
    }

    if (!config.dryRun) {
      await context.storageState({ path: config.sessionPath });
    }

    return {
      automation: "hellcase.daily",
      ok: results.every((result) => result.ok),
      dryRun: config.dryRun,
      messages: results.map((result) => result.message),
    };
  } finally {
    await browser.close();
  }
}

export const hellcaseDailyAutomation: AutomationDefinition = {
  id: "hellcase.daily",
  description:
    "Join the eligible free Hellcase giveaway and open the free newbie case.",
  run: runHellcaseDaily,
};
