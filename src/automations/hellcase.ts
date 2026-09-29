import type { Browser, BrowserContext, Page } from "playwright";
import { createPersistedBrowser } from "../browser.js";
import { config } from "../config.js";
import {
  assertNoPaidRequirement,
  findFreeGiveaway,
  findJoinButton,
  isAlreadyJoined,
  type GiveawayCadence,
} from "../giveaways.js";
import { appendAutomationLog } from "../logs.js";
import {
  assertFreeNewbieCase,
  findOpenNewbieCaseButton,
  isNewbieCaseAlreadyOpened,
} from "../newbie.js";
import type {
  AutomationDefinition,
  AutomationLogEntry,
  AutomationRunResult,
} from "./types.js";

function entry(
  action: string,
  status: AutomationLogEntry["status"],
  message: string,
  extra: Pick<AutomationLogEntry, "target" | "reward"> = {}
): AutomationLogEntry {
  return {
    timestamp: new Date().toISOString(),
    action,
    status,
    dryRun: config.dryRun,
    message,
    ...extra,
  };
}

async function assertSession(page: Page): Promise<void> {
  if (/login|signin|steam/i.test(page.url())) {
    throw new Error("Hellcase session appears to be expired.");
  }
}

async function runGiveaway(
  action: string,
  cadence: GiveawayCadence,
  url: string,
  context: BrowserContext
): Promise<AutomationLogEntry> {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await assertSession(page);

    const candidate = await findFreeGiveaway(page, cadence);
    if (!candidate) {
      return entry(action, "skipped", `No clearly identifiable free ${cadence} giveaway found.`);
    }

    await page.goto(candidate.href, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await assertNoPaidRequirement(page);

    if (await isAlreadyJoined(page)) {
      return entry(action, "already_joined", `${cadence} giveaway already joined.`, {
        target: candidate.href,
      });
    }

    const joinButton = await findJoinButton(page);
    if (!joinButton) {
      throw new Error("Eligible giveaway found, but no visible join button was detected.");
    }

    if (config.dryRun) {
      return entry(action, "skipped", `Dry-run: would join free ${cadence} giveaway.`, {
        target: candidate.href,
      });
    }

    await joinButton.click();
    await page.waitForTimeout(1_500);
    if (!(await isAlreadyJoined(page))) {
      throw new Error("Join button was clicked, but participation could not be confirmed.");
    }

    return entry(action, "joined", `Joined free ${cadence} giveaway.`, {
      target: candidate.href,
    });
  } finally {
    await page.close();
  }
}

async function readCaseReward(page: Page): Promise<AutomationLogEntry["reward"]> {
  const roots = [
    page.locator('[role="dialog"]'),
    page.locator('[class*="case-result"]'),
    page.locator('[class*="roulette"]'),
    page.locator('[class*="reward"]'),
  ];

  for (const root of roots) {
    if ((await root.count()) === 0) continue;
    const candidate = root.last();
    const rawText = (await candidate.innerText().catch(() => "")).trim();
    if (!rawText) continue;

    const name = (
      await candidate
        .locator('[data-testid*="item-name"], [class*="item-name"], [class*="reward-name"]')
        .first()
        .innerText()
        .catch(() => "")
    ).trim() || undefined;
    const value = (
      await candidate
        .locator('[data-testid*="price"], [class*="item-price"], [class*="reward-price"]')
        .first()
        .innerText()
        .catch(() => "")
    ).trim() || undefined;

    return { name, value, rawText: rawText.slice(0, 500) };
  }

  return undefined;
}

async function runDailyCase(
  action: string,
  context: BrowserContext
): Promise<AutomationLogEntry> {
  const page = await context.newPage();
  try {
    await page.goto(config.newbieCaseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await assertSession(page);
    await assertFreeNewbieCase(page);

    if (await isNewbieCaseAlreadyOpened(page)) {
      return entry(action, "already_opened", "Free daily case already opened.", {
        target: config.newbieCaseUrl,
      });
    }

    const openButton = await findOpenNewbieCaseButton(page);
    if (!openButton) {
      throw new Error("Free case page found, but no visible free open button was detected.");
    }

    if (config.dryRun) {
      return entry(action, "skipped", "Dry-run: would open free daily case.", {
        target: config.newbieCaseUrl,
      });
    }

    await openButton.click();
    await page.waitForTimeout(4_000);
    const reward = await readCaseReward(page);
    if (!reward?.name) {
      return entry(
        action,
        "opened",
        "Free daily case opened, but the reward name could not be parsed. Review the recorded page text before another run.",
        { target: config.newbieCaseUrl, reward }
      );
    }

    const value = reward.value ? ` (${reward.value})` : "";
    return entry(action, "opened", `Free daily case opened: ${reward.name}${value}.`, {
      target: config.newbieCaseUrl,
      reward,
    });
  } finally {
    await page.close();
  }
}

async function runAction(
  id: string,
  task: (context: BrowserContext) => Promise<AutomationLogEntry>
): Promise<AutomationRunResult> {
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let log: AutomationLogEntry;
  try {
    const persisted = await createPersistedBrowser(
      config.sessionPath,
      config.headless
    );
    browser = persisted.browser;
    context = persisted.context;

    try {
      log = await task(context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log = entry(id, "error", message);
    }

    if (!config.dryRun) {
      await context.storageState({ path: config.sessionPath });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log = entry(id, "error", message);
  } finally {
    await browser?.close();
  }

  await appendAutomationLog(config.logPath, log);
  return {
    automation: id,
    ok: log.status !== "error",
    dryRun: config.dryRun,
    messages: [log.message],
    logs: [log],
  };
}

export const hellcaseDailyGiveawayAutomation: AutomationDefinition = {
  id: "hellcase.giveaway.daily",
  description: "Join the eligible free daily Hellcase giveaway.",
  run: () =>
    runAction("hellcase.giveaway.daily", (context) =>
      runGiveaway(
        "hellcase.giveaway.daily",
        "daily",
        config.giveawaysUrl,
        context
      )
    ),
};

export const hellcaseWeeklyGiveawayAutomation: AutomationDefinition = {
  id: "hellcase.giveaway.weekly",
  description: "Join the eligible free weekly Hellcase giveaway.",
  run: () =>
    runAction("hellcase.giveaway.weekly", (context) =>
      runGiveaway(
        "hellcase.giveaway.weekly",
        "weekly",
        config.weeklyGiveawaysUrl,
        context
      )
    ),
};

export const hellcaseDailyCaseAutomation: AutomationDefinition = {
  id: "hellcase.case.daily",
  description: "Open the eligible free daily Hellcase case and record its reward.",
  run: () =>
    runAction("hellcase.case.daily", (context) =>
      runDailyCase("hellcase.case.daily", context)
    ),
};
