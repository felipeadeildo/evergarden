const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const absolute = new Intl.DateTimeFormat("en", { dateStyle: "long", timeStyle: "short" });

export function formatRelative(date: Date, now = Date.now()): string {
  const seconds = Math.round((date.getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

const day = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const dayOfYear = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "now", "34m", "2h", "3d" within a week, then "Nov 14", and the year once it is not this one. */
export function formatShort(date: Date, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 24 * 3600) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 7 * 24 * 3600) return `${Math.floor(seconds / (24 * 3600))}d`;
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return (sameYear ? day : dayOfYear).format(date);
}

/**
 * "2 hours ago", or "2h" when `short`, with the full date on hover. Server and browser clocks may
 * differ by a minute, so hydration accepts a different text.
 */
export function RelativeTime({ date, short = false }: { date: Date; short?: boolean }) {
  return (
    <time dateTime={date.toISOString()} title={absolute.format(date)} suppressHydrationWarning>
      {short ? formatShort(date) : formatRelative(date)}
    </time>
  );
}
