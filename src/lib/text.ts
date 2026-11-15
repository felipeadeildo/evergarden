export const FOLDER_PAGE_SIZE = 50;

export function plural(count: number, noun: string, nouns = `${noun}s`): string {
  return `${count} ${count === 1 ? noun : nouns}`;
}
