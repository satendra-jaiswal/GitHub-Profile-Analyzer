const successResponse = (res, statusCode, message, data = null, pagination = null) => {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  if (pagination !== null) payload.pagination = pagination;
  return res.status(statusCode).json(payload);
};

const errorResponse = (res, statusCode, message, errors = null) => {
  const payload = { success: false, message };
  if (errors !== null) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

module.exports = { successResponse, errorResponse };
