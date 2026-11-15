const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN = /^@[^\s@]+\.[^\s@]+$/;

/** Whether an entry of a sharing list is an email or an `@domain`. */
export function isPersonOrDomain(entry: string): boolean {
  return EMAIL.test(entry) || DOMAIN.test(entry);
}

/** Cleans a list of emails and `@domains`: lower case, no repeats. Throws on anything else. */
export function normalizePeople(people: string[]): string[] {
  const clean = [...new Set(people.map((entry) => entry.trim().toLowerCase()).filter(Boolean))];
  const wrong = clean.find((entry) => !isPersonOrDomain(entry));
  if (wrong) throw new Error(`"${wrong}" is neither an email nor an @domain.`);
  return clean;
}

/** Whether `email` is on a list of emails and `@domains`. */
export function listed(people: string[], email: string | null | undefined): boolean {
  if (!email) return false;
  const address = email.toLowerCase();
  return people.some((entry) =>
    entry.startsWith("@") ? address.endsWith(entry) : address === entry,
  );
}
