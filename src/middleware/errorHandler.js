module.exports = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  let status = err.status || 500;
  let message = err.message;

  switch (err.code) {
    case '23505': status = 409; message = `Duplicate value: ${err.detail || err.constraint}`; break;
    case '23503': status = 409; message = 'Blocked: record is referenced by other data, or references something that does not exist'; break;
    case '23514': status = 400; message = 'A value failed a database check (e.g. amount must be positive, invalid method)'; break;
    case '22P02': case '22007': case '22008': status = 400; message = 'Invalid input format'; break;
    default: break;
  }

  if (status === 500) console.error(err);
  const hide = status === 500 && process.env.NODE_ENV === 'production';
  res.status(status).json({ error: hide ? 'Internal server error' : message });
};
