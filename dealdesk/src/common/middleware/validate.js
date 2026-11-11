// Validates and normalises req.body against a Joi schema.
function validate(schema) {
  return (req, res, next) => {
    const { value, error } = schema.validate(req.body ?? {}, { abortEarly: false, stripUnknown: true });
    if (error) throw error;
    req.body = value;
    next();
  };
}

module.exports = { validate };
