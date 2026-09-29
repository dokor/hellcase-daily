import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { AutomationLogEntry } from "./automations/types.js";

export async function appendAutomationLog(
  path: string,
  entry: AutomationLogEntry
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(entry) + "\n", "utf8");
  console.log(JSON.stringify(entry));
}
