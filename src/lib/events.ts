import { db } from "./db";

export async function logEvent(level: "info" | "warn" | "error", source: string, message: string, userId?: string | null) {
  try {
    await db.systemEvent.create({ data: { level, source, message: message.slice(0, 1000), userId: userId ?? null } });
  } catch (e) {
    console.error("logEvent failed", e);
  }
  if (level === "error") console.error(`[${source}]`, message);
}
