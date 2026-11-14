const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
// 252 is 7 × 36: skipping bytes from 252 up keeps every character equally likely.
const LIMIT = 252;

export function newId(length = 10): string {
  let id = "";
  while (id.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length))) {
      if (byte < LIMIT && id.length < length) id += ALPHABET[byte % ALPHABET.length];
    }
  }
  return id;
}
