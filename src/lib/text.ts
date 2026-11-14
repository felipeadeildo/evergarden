export const FOLDER_PAGE_SIZE = 50;

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
