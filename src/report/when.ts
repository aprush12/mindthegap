/** Friendly, local-time phrasing for the caretaker-facing summary. Never emits ISO strings, seconds or zones. */
const pad = (n: number) => String(n).padStart(2, "0");
const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "9:00 PM" */
export function clock(d: Date): string {
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())} ${h < 12 ? "AM" : "PM"}`;
}

/** "6 PM" or "6:30 PM" from a "HH:MM" string. */
export function clockFromHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}${m ? `:${pad(m)}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * Phrase a moment relative to arrival: "tonight 9:00 PM", "tomorrow 8:00 AM", "Sat 11:00 AM", "Nov 25 9:00 AM".
 * Evening arrival: small hours after midnight still read as "tonight".
 */
export function friendlyWhen(iso: string | undefined, arrivalIso?: string): string {
  if (!iso) return "unknown time";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown time";
  const arr = arrivalIso && !Number.isNaN(new Date(arrivalIso).getTime()) ? new Date(arrivalIso) : new Date();
  const days = Math.round((startOfDay(d) - startOfDay(arr)) / DAY);
  const t = clock(d);
  const eveningArrival = arr.getHours() >= 17;
  if (days < 0) return `already past (${t})`;
  if (days === 0) return `${d.getHours() >= 17 || d.getHours() < 5 ? "tonight" : "today"} ${t}`;
  if (days === 1) return `${eveningArrival && d.getHours() < 5 ? "tonight" : "tomorrow"} ${t}`;
  if (days < 7) return `${d.toLocaleString("en-US", { weekday: "short" })} ${t}`;
  return `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()} ${t}`;
}

/** Deadline label for a priority line; "" when the text already says it. */
export function dueLabel(ruleIds: string[], dueBy: string | undefined, arrivalIso?: string): string {
  if (!dueBy) return "";
  if (ruleIds.includes("ACU-06")) return "before first meal";
  return `by ${friendlyWhen(dueBy, arrivalIso)}`;
}

/** Replace any ISO timestamp embedded in free text with a friendly phrase. */
export function scrubTimes(text: string, arrivalIso?: string): string {
  return text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?/g, (m) => friendlyWhen(m, arrivalIso));
}
