const AppError = require('../errors/AppError');

function notFound(req, res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message;
  let details = err.details;

  if (err.isJoi) {
    status = 400;
    message = 'Validation failed';
    details = err.details.map((d) => d.message);
  } else if (err.name === 'ValidationError') {
    status = 400;
    details = Object.values(err.errors).map((e) => e.message);
  } else if (err.name === 'CastError') {
    // a malformed id can never match a record the user may see
    status = 404;
    message = 'Not found';
  } else if (err.code === 11000) {
    status = 409;
    message = 'Duplicate value';
  }

  if (status >= 500) {
    console.error(err);
    message = 'Internal server error';
  }

  res.status(status).json({ error: message, ...(details && { details }) });
}

module.exports = { notFound, errorHandler };
