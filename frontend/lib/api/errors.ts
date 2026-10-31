export class ApiError extends Error {
  status: number;
  code: string;
  hint: string | null;

  constructor(status: number, code: string, message: string, hint: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}
