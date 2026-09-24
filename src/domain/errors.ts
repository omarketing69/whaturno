export type DomainErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "INVALID_PHONE"
  | "PHONE_REQUIRED"
  | "DUPLICATE_ACTIVE_ORDER"
  | "INVALID_TRANSITION"
  | "FORBIDDEN";

const HTTP: Record<DomainErrorCode, number> = {
  NOT_FOUND: 404,
  VALIDATION: 422,
  INVALID_PHONE: 422,
  PHONE_REQUIRED: 422,
  DUPLICATE_ACTIVE_ORDER: 409,
  INVALID_TRANSITION: 409,
  FORBIDDEN: 403,
};

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
  }
  get httpStatus() {
    return HTTP[this.code];
  }
}
