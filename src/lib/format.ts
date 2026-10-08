import { format, formatDistanceToNowStrict, isToday, parseISO } from "date-fns";

export function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return format(parseISO(value), "d MMM yyyy");
}

export function fmtShortDate(value: string | null | undefined) {
  if (!value) return "—";
  return format(parseISO(value), "d MMM");
}

export function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = parseISO(value);
  return isToday(d) ? `Today, ${format(d, "h:mm a")}` : format(d, "d MMM, h:mm a");
}

export function fmtAgo(value: string | null | undefined) {
  if (!value) return "—";
  return `${formatDistanceToNowStrict(parseISO(value))} ago`;
}

export function fmtNumber(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

/** Demo records carry a "(demo)" suffix in the name; show it as a badge instead. */
export function displayName(name: string | null | undefined) {
  return (name ?? "").replace(/\s*\(demo\)\s*$/i, "").trim();
}

export function firstName(name: string | null | undefined) {
  return displayName(name).split(/\s+/)[0] ?? "";
}

export function initials(name: string | null | undefined) {
  return displayName(name)
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
