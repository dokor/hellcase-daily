export type AutomationRunResult = {
  automation: string;
  ok: boolean;
  dryRun: boolean;
  messages: string[];
};

export type AutomationDefinition = {
  id: string;
  description: string;
  run: () => Promise<AutomationRunResult>;
};
