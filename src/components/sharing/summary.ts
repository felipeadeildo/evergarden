import type { ShareSettings, SharingState } from "#/server/sharing";

export type SharingKind = "private" | "link" | "people";

/** The setting that decides what others see: the page's own, or else a folder's above it. */
export function effective(state: SharingState | null): ShareSettings | null {
  if (!state) return null;
  return state.own ?? state.inherited[0] ?? null;
}

export function kindOf(settings: ShareSettings | null): SharingKind {
  return settings?.audience ?? "private";
}

/** A few words for the top bar: "Only you", "Link, read", "ana@acme.com +1, comment". */
export function shortLabel(settings: ShareSettings | null): string {
  if (!settings) return "Only you";
  const [first, ...rest] = settings.people;
  const who =
    settings.audience === "link"
      ? "Link"
      : `${first ?? "People"}${rest.length ? ` +${rest.length}` : ""}`;
  return `${who}, ${settings.permission}`;
}

/** The whole policy as a sentence: who, what they can do, which versions, until when. */
export function sentence(settings: ShareSettings | null): string {
  if (!settings) return "Only you can open this.";
  const who = settings.audience === "link" ? "Anyone with the link" : listOf(settings.people);
  const can = settings.permission === "comment" ? "can read and comment" : "can read";
  const versions = settings.versions === "all" ? "every version" : "the current version only";
  const until = settings.expiresAt ? `, until ${day.format(new Date(settings.expiresAt))}` : "";
  return `${who} ${can}, ${versions}${until}.`;
}

const day = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

function listOf(people: string[]): string {
  if (people.length <= 2) return people.join(" and ");
  return `${people.slice(0, 2).join(", ")} and ${people.length - 2} more`;
}
