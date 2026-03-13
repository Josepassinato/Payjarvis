import type { RuleEvaluation } from "@payjarvis/types";
import type { PolicyConfig } from "@payjarvis/types";

function formatHour12(hour: number): string {
  if (hour === 0) return "12:00am";
  if (hour === 12) return "12:00pm";
  return hour < 12 ? `${hour}:00am` : `${hour - 12}:00pm`;
}

function getLocalTime(timezone: string): { day: number; hour: number; tzLabel: string } {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
      weekday: "short",
    }).formatToParts(now);

    const hourPart = parts.find((p) => p.type === "hour");
    const dayPart = parts.find((p) => p.type === "weekday");

    const hour = parseInt(hourPart?.value ?? "0", 10);
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = dayMap[dayPart?.value ?? ""] ?? now.getDay();

    return { day, hour, tzLabel: timezone };
  } catch {
    // Invalid timezone — fall back to server time
    const now = new Date();
    return { day: now.getDay(), hour: now.getHours(), tzLabel: "server" };
  }
}

export function checkTimeWindow(policy: PolicyConfig): RuleEvaluation {
  const { day: currentDay, hour: currentHour, tzLabel } = getLocalTime(policy.timezone ?? "America/New_York");

  // Check allowed days
  if (!policy.allowedDays.includes(currentDay)) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return {
      rule: "checkTimeWindow",
      passed: false,
      reason: `Transactions not allowed on ${dayNames[currentDay]} (${tzLabel})`,
    };
  }

  // Check allowed hours
  if (currentHour < policy.allowedHoursStart || currentHour >= policy.allowedHoursEnd) {
    return {
      rule: "checkTimeWindow",
      passed: false,
      reason: `Current hour ${formatHour12(currentHour)} is outside allowed window ${formatHour12(policy.allowedHoursStart)}-${formatHour12(policy.allowedHoursEnd)} (${tzLabel})`,
    };
  }

  return {
    rule: "checkTimeWindow",
    passed: true,
    reason: `Current time is within allowed window`,
  };
}
