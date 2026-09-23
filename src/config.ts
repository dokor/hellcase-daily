import "dotenv/config";

function bool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const config = {
  baseUrl: process.env.HELLCASE_BASE_URL ?? "https://hellcase.com/fr",
  giveawaysUrl:
    process.env.HELLCASE_GIVEAWAYS_URL ??
    "https://hellcase.com/fr/giveaways",
  newbieCaseUrl:
    process.env.HELLCASE_NEWBIE_CASE_URL ??
    "https://hellcase.com/fr/open/newbie",
  sessionPath:
    process.env.HELLCASE_SESSION_PATH ?? "./data/hellcase-session.json",
  headless: bool("HEADLESS", true),
  dryRun: bool("DRY_RUN", true),
  ntfyUrl: process.env.NTFY_URL?.trim() || undefined,
};
