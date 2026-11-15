const STATUS = {
  invalid: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  too_large: 413,
} as const;

export type ErrorCode = keyof typeof STATUS;

/** An error whose message is safe to show to the caller: the UI, the API and MCP all pass it on. */
export class EvergardenError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "EvergardenError";
    this.code = code;
  }

  get status(): number {
    return STATUS[this.code];
  }
}
