/** Documents a folder page loads at a time; the server pages by it and the "Show more" button counts by it. */
export const FOLDER_PAGE_SIZE = 50;

/** "1 document", "3 documents". */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
