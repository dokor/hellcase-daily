import { access } from "node:fs/promises";
import { chromium, type Browser, type BrowserContext } from "playwright";

export type PersistedBrowser = {
  browser: Browser;
  context: BrowserContext;
};

export async function createPersistedBrowser(
  sessionPath: string,
  headless: boolean
): Promise<PersistedBrowser> {
  try {
    await access(sessionPath);
  } catch {
    throw new Error(
      "Missing browser session at " +
        sessionPath +
        ". Create or copy the session before running the automation."
    );
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    storageState: sessionPath,
  });

  return { browser, context };
}
