import { hellcaseDailyAutomation } from "./hellcase.js";
import type { AutomationDefinition } from "./types.js";

const automations = new Map<string, AutomationDefinition>([
  [hellcaseDailyAutomation.id, hellcaseDailyAutomation],
]);

export function listAutomations(): Array<
  Pick<AutomationDefinition, "id" | "description">
> {
  return [...automations.values()].map(({ id, description }) => ({
    id,
    description,
  }));
}

export function getAutomation(id: string): AutomationDefinition | undefined {
  return automations.get(id);
}
