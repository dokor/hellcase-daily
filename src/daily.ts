import { getAutomation } from "./automations/index.js";
import { notify } from "./notify.js";

const automationIds = [
  "hellcase.giveaway.daily",
  "hellcase.case.daily",
];

for (const automationId of automationIds) {
  const automation = getAutomation(automationId);
  if (!automation) throw new Error(automationId + " automation is not registered.");

  try {
    const result = await automation.run();
    await notify(result.messages.join("\n"));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await notify("❌ " + automationId + ": " + message);
    process.exitCode = 1;
  }
}
