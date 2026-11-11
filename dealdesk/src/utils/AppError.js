class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }

  static badRequest(msg, details) { return new AppError(400, msg, details); }
  static unauthorized(msg = 'Unauthorized') { return new AppError(401, msg); }
  static forbidden(msg = 'Forbidden') { return new AppError(403, msg); }
  static notFound(msg = 'Not found') { return new AppError(404, msg); }
  static conflict(msg) { return new AppError(409, msg); }
}

module.exports = AppError;
