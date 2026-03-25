import { ZodError } from "zod"

export type AppErrorCode =
  | "validation_error"
  | "authentication_required"
  | "authentication_failed"
  | "authorization_failed"
  | "resource_not_found"
  | "resource_conflict"
  | "rate_limited"
  | "origin_not_allowed"
  | "dependency_unavailable"
  | "internal_error"

export class AppError extends Error {
  readonly statusCode: number
  readonly code: AppErrorCode
  readonly details?: unknown
  readonly exposeDetails: boolean

  constructor(
    message: string,
    statusCode: number,
    code: AppErrorCode,
    options?: {
      details?: unknown
      exposeDetails?: boolean
      cause?: unknown
    }
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined)
    this.name = "AppError"
    this.statusCode = statusCode
    this.code = code
    this.details = options?.details
    this.exposeDetails = options?.exposeDetails ?? false
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, "validation_error", {
      details,
      exposeDetails: true,
    })
    this.name = "ValidationError"
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Unauthorized", code: AppErrorCode = "authentication_required") {
    super(message, 401, code)
    this.name = "AuthenticationError"
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Forbidden", code: AppErrorCode = "authorization_failed") {
    super(message, 403, code)
    this.name = "AuthorizationError"
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "resource_not_found")
    this.name = "NotFoundError"
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "resource_conflict")
    this.name = "ConflictError"
  }
}

export class RateLimitError extends AppError {
  constructor(message: string) {
    super(message, 429, "rate_limited")
    this.name = "RateLimitError"
  }
}

export class DependencyError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 503, "dependency_unavailable", { cause })
    this.name = "DependencyError"
  }
}

export const toValidationAppError = (error: ZodError) =>
  new ValidationError("Payload tidak valid", {
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    })),
  })
