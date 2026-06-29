import { EventExtractor } from "@/lib/ai/extractor";
import { ExtractedEvent, NormalizedMessage } from "@/lib/domain/types";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

const EXPLICIT_DATE_REGEX = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i;
const MONTH_NAME_DATE_REGEX =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,\s*(\d{4}))?\b/i;
const TIME_REGEX = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b([01]?\d|2[0-3]):([0-5]\d)\b/i;

function parseTime(text: string): { hour: number; minute: number } | null {
  const match = text.match(TIME_REGEX);
  if (!match) return null;

  if (match[4] && match[5]) {
    return { hour: Number(match[4]), minute: Number(match[5]) };
  }

  const rawHour = Number(match[1] ?? "0");
  const minute = Number(match[2] ?? "0");
  const meridiem = match[3]?.toLowerCase();
  if (Number.isNaN(rawHour) || Number.isNaN(minute) || minute > 59) return null;

  if (!meridiem) {
    return rawHour > 23 ? null : { hour: rawHour, minute };
  }

  const hour = rawHour % 12 + (meridiem === "pm" ? 12 : 0);
  return { hour, minute };
}

function nextWeekdayDate(base: Date, weekday: (typeof WEEKDAYS)[number]): Date {
  const target = WEEKDAYS.indexOf(weekday);
  const clone = new Date(base);
  const current = clone.getDay();
  const delta = (target - current + 7) % 7 || 7;
  clone.setDate(clone.getDate() + delta);
  return clone;
}

function parseDate(text: string, receivedAt: string): Date | null {
  const now = new Date(receivedAt);
  const lower = text.toLowerCase();

  if (lower.includes("today")) return now;
  if (lower.includes("tomorrow")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  const nextWeekdayMatch = lower.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (nextWeekdayMatch) {
    return nextWeekdayDate(now, nextWeekdayMatch[1] as (typeof WEEKDAYS)[number]);
  }

  const thisWeekdayMatch = lower.match(/\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (thisWeekdayMatch) {
    const parsed = nextWeekdayDate(now, thisWeekdayMatch[1] as (typeof WEEKDAYS)[number]);
    if (parsed.getDay() === now.getDay()) {
      return now;
    }
    parsed.setDate(parsed.getDate() - 7);
    return parsed < now ? nextWeekdayDate(now, thisWeekdayMatch[1] as (typeof WEEKDAYS)[number]) : parsed;
  }

  const explicit = lower.match(EXPLICIT_DATE_REGEX);
  if (explicit) {
    const token = explicit[1];
    if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
      const [year, month, day] = token.split("-").map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(token)) {
      const [m, d, y] = token.split("/");
      const year = y ? Number(y.length === 2 ? `20${y}` : y) : now.getUTCFullYear();
      const parsed = new Date(Date.UTC(year, Number(m) - 1, Number(d)));
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  const monthNameMatch = lower.match(MONTH_NAME_DATE_REGEX);
  if (monthNameMatch) {
    const month = MONTHS.indexOf(monthNameMatch[1] as (typeof MONTHS)[number]);
    const day = Number(monthNameMatch[2]);
    const year = Number(monthNameMatch[3] ?? String(now.getFullYear()));
    if (month >= 0) {
      const parsed = new Date(Date.UTC(year, month, day));
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  return null;
}

function fallbackTimeFromPhrase(text: string): { hour: number; minute: number } | null {
  const lower = text.toLowerCase();
  if (lower.includes("at noon") || lower.includes("noon")) return { hour: 12, minute: 0 };
  if (lower.includes("midnight")) return { hour: 0, minute: 0 };
  if (lower.includes("in the morning")) return { hour: 9, minute: 0 };
  if (lower.includes("in the afternoon")) return { hour: 15, minute: 0 };
  if (lower.includes("in the evening")) return { hour: 18, minute: 0 };
  return null;
}

export class RuleBasedEventExtractor implements EventExtractor {
  async extractEvent(message: NormalizedMessage): Promise<ExtractedEvent | null> {
    const body = `${message.metadata?.subject ?? ""}\n${message.text}`;
    const date = parseDate(body, message.receivedAt);
    const time = parseTime(body) ?? fallbackTimeFromPhrase(body);

    if (!date || !time) return null;

    const start = new Date(date);
    start.setHours(time.hour, time.minute, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    return {
      title: message.metadata?.subject || "Meeting",
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      timezone: "UTC",
      location: undefined,
      participants: message.participants,
      description: `Detected from ${message.platform} message ${message.id}`,
      confidence: 0.72,
    };
  }
}
