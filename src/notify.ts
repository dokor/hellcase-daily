import { config } from "./config.js";

export async function notify(message: string): Promise<void> {
  console.log(message);

  if (!config.ntfyUrl) return;

  try {
    await fetch(config.ntfyUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: message,
    });
  } catch (error) {
    console.warn("Unable to send ntfy notification:", error);
  }
}
