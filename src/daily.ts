import { getAutomation } from "./automations/index.js";
import { notify } from "./notify.js";

const automation = getAutomation("hellcase.daily");

if (!automation) {
  throw new Error("hellcase.daily automation is not registered.");
}

automation
  .run()
  .then(async (result) => {
    await notify(result.messages.join("\n"));
    if (!result.ok) process.exitCode = 1;
  })
  .catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    await notify("❌ Hellcase daily: " + message);
    process.exitCode = 1;
  });
