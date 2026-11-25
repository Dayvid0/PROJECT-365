export class DalError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class UnauthorizedError extends DalError {
  constructor(message = "Authentication required.") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends DalError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends DalError {
  constructor(message = "Requested resource was not found.") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ValidationError extends DalError {
  constructor(message = "Invalid input provided.") {
    super(message, "VALIDATION_ERROR", 400);
  }
}
