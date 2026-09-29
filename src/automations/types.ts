export type AutomationLogEntry = {
  timestamp: string;
  action: string;
  status: "joined" | "already_joined" | "opened" | "already_opened" | "skipped" | "error";
  dryRun: boolean;
  message: string;
  target?: string;
  reward?: {
    name?: string;
    value?: string;
    rawText?: string;
  };
};

export type AutomationRunResult = {
  automation: string;
  ok: boolean;
  dryRun: boolean;
  messages: string[];
  logs: AutomationLogEntry[];
};

export type AutomationDefinition = {
  id: string;
  description: string;
  run: () => Promise<AutomationRunResult>;
};
