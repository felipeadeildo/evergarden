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

/** "2 hours ago", with the full date on hover. Server and browser clocks may differ by a minute. */
export function RelativeTime({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()} title={absolute.format(date)} suppressHydrationWarning>
      {formatRelative(date)}
    </time>
  );
}
