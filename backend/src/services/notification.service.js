const { v4: uuidv4 } = require('uuid');

/**
 * Non-blocking helper — creates a notification for one recipient.
 * Failure is logged but never propagates (won't break the calling action).
 *
 * @param {import('../config/db')} db    - Pool / connection from ../config/db
 * @param {object} opts
 * @param {string} opts.recipient_id     - employees.id of the person to notify
 * @param {string} opts.title            - Short notification title
 * @param {string} [opts.body]           - Optional longer body text
 * @param {'info'|'success'|'warning'|'error'} [opts.type] - Visual type (default 'info')
 * @param {string} [opts.entity_type]   - e.g. 'support_task', 'task', 'placement_offer'
 * @param {string} [opts.entity_id]     - UUID of the related record
 */
async function createNotification(db, {
  recipient_id,
  title,
  body        = null,
  type        = 'info',
  entity_type = null,
  entity_id   = null,
}) {
  if (!recipient_id || !title) return; // guard: nothing to do without a recipient and title
  try {
    const id = uuidv4();
    await db.query(
      `INSERT INTO notifications
         (id, recipient_employee_id, title, body, type, entity_type, entity_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, recipient_id, title, body, type, entity_type, entity_id]
    );
  } catch (err) {
    console.error('[notification.service] createNotification failed:', err.message);
    // intentionally swallowed — notifications must never break the main action
  }
}

/**
 * Bulk helper — fires the same notification to multiple recipients.
 * Runs each insert non-blocking; all failures are silently logged.
 *
 * @param {import('../config/db')} db
 * @param {string[]} recipient_ids
 * @param {object} opts                 - Same shape as createNotification (minus recipient_id)
 */
async function notifyMany(db, recipient_ids, opts) {
  await Promise.all(
    (recipient_ids || []).map(rid => createNotification(db, { ...opts, recipient_id: rid }))
  );
}

module.exports = { createNotification, notifyMany };
