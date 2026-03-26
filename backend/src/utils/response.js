/**
 * Standardised API response helpers.
 * All controllers use these to keep responses consistent.
 */

function ok(res, data, meta = {}) {
  return res.json({ success: true, data, ...meta });
}

function created(res, data) {
  return res.status(201).json({ success: true, data });
}

function notFound(res, message = 'Not found') {
  return res.status(404).json({ success: false, error: message });
}

function badRequest(res, message = 'Bad request') {
  return res.status(400).json({ success: false, error: message });
}

function forbidden(res, message = 'Forbidden') {
  return res.status(403).json({ success: false, error: message });
}

function serverError(res, err) {
  console.error(err);
  return res.status(500).json({ success: false, error: err.message || 'Server error' });
}

module.exports = { ok, created, notFound, badRequest, forbidden, serverError };
