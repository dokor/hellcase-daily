import type { Page } from "playwright";

const paidSignals = [
  /deposit/i,
  /d[eé]p[oô]t/i,
  /purchase/i,
  /acheter/i,
  /pay/i,
  /payer/i,
  /spend/i,
  /d[eé]penser/i,
  /balance/i,
  /solde/i,
];

const openedSignals = [
  /already opened/i,
  /already claimed/i,
  /opened today/i,
  /d[eé]j[aà] ouvert/i,
  /d[eé]j[aà] r[eé]clam[eé]/i,
  /revenez demain/i,
  /come back tomorrow/i,
];

export async function assertFreeNewbieCase(page: Page): Promise<void> {
  const body = await page.locator("body").innerText();

  const hasFreeSignal =
    /free/i.test(body) ||
    /gratuit/i.test(body) ||
    /0(?:[.,]00)?\s*(?:€|\$|USD|EUR)?/i.test(body);

  if (!hasFreeSignal) {
    throw new Error(
      "Newbie case page does not contain a clear free/zero-cost signal. Refusing to open it."
    );
  }

  if (paidSignals.some((signal) => signal.test(body))) {
    throw new Error(
      "Newbie case page contains a possible paid requirement. Refusing to continue."
    );
  }
}

export async function isNewbieCaseAlreadyOpened(page: Page): Promise<boolean> {
  const body = await page.locator("body").innerText().catch(() => "");
  return openedSignals.some((signal) => signal.test(body));
}

export async function findOpenNewbieCaseButton(page: Page) {
  const candidates = [
    page.getByRole("button", { name: /open|ouvrir|claim|r[eé]clamer/i }),
    page.getByRole("link", { name: /open|ouvrir|claim|r[eé]clamer/i }),
  ];

  for (const locator of candidates) {
    if ((await locator.count()) === 0) continue;

    for (let i = 0; i < await locator.count(); i++) {
      const candidate = locator.nth(i);
      if (!(await candidate.isVisible().catch(() => false))) continue;

      const text = await candidate.innerText().catch(() => "");
      if (paidSignals.some((signal) => signal.test(text))) continue;

      return candidate;
    }
  }

  return null;
}
