import type { Locator, Page } from "playwright";

export type GiveawayCandidate = {
  href: string;
  text: string;
  score: number;
};

const paidSignals = [
  /deposit/i,
  /d[eé]p[oô]t/i,
  /open\s+case/i,
  /ouvrir\s+.*caisse/i,
  /purchase/i,
  /acheter/i,
  /spend/i,
  /d[eé]penser/i,
];

const freeSignals = [
  /free/i,
  /gratuit/i,
  /daily/i,
  /quotidien/i,
  /journalier/i,
];

const joinedSignals = [
  /joined/i,
  /participating/i,
  /inscrit/i,
  /participation confirm[eé]e/i,
];

function normalizeHref(href: string): string {
  try {
    return new URL(href, "https://hellcase.com").toString();
  } catch {
    return href;
  }
}

function score(text: string, href: string): number {
  let value = 0;
  for (const signal of freeSignals) {
    if (signal.test(text) || signal.test(href)) value += 2;
  }
  if (/giveaway/i.test(href)) value += 1;
  return value;
}

function looksPaid(text: string): boolean {
  return paidSignals.some((signal) => signal.test(text));
}

export async function findFreeDailyGiveaway(
  page: Page
): Promise<GiveawayCandidate | null> {
  const links = page.locator('a[href*="giveaway"]');
  const count = await links.count();

  const byHref = new Map<string, GiveawayCandidate>();

  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    const href = await link.getAttribute("href");
    if (!href) continue;

    const card = link.locator("xpath=ancestor-or-self::*[self::a or self::article or self::div][1]");
    const text = ((await card.innerText().catch(() => "")) || (await link.innerText().catch(() => ""))).trim();
    if (!text || looksPaid(text)) continue;

    const normalized = normalizeHref(href);
    const candidate = { href: normalized, text, score: score(text, normalized) };

    const current = byHref.get(normalized);
    if (!current || candidate.score > current.score) {
      byHref.set(normalized, candidate);
    }
  }

  return [...byHref.values()]
    .filter((candidate) => candidate.score >= 3)
    .sort((a, b) => b.score - a.score)[0] ?? null;
}

export async function isAlreadyJoined(page: Page): Promise<boolean> {
  const body = await page.locator("body").innerText().catch(() => "");
  return joinedSignals.some((signal) => signal.test(body));
}

export async function assertNoPaidRequirement(page: Page): Promise<void> {
  const body = await page.locator("body").innerText();
  if (looksPaid(body)) {
    throw new Error(
      "Giveaway page contains a paid/deposit requirement. Refusing to continue."
    );
  }
}

export async function findJoinButton(page: Page): Promise<Locator | null> {
  const selectors = [
    page.getByRole("button", { name: /join|participer|s'inscrire|inscription/i }),
    page.getByRole("link", { name: /join|participer|s'inscrire|inscription/i }),
  ];

  for (const locator of selectors) {
    if ((await locator.count()) > 0) {
      const candidate = locator.first();
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
  }

  return null;
}
