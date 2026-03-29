/**
 * Payment Reminder Scheduler
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs every hour. Checks for candidates whose next_payment_date is:
 *   • TODAY    → sends a "Payment Due Today" warning to the salesperson
 *   • TOMORROW → sends a "Payment Due Tomorrow" info to the salesperson
 *
 * Each reminder is only sent once per day (tracked via a simple in-memory Set
 * keyed by "<candidate_id>:<date>" so it resets on server restart—acceptable
 * for a daily reminder use-case).
 */

const db                         = require('../config/db');
const { createNotification }      = require('./notification.service');
const { sendPaymentReminderEmail } = require('./email.service');

// In-memory dedup: "<candidateId>:<YYYY-MM-DD>" → prevents double-firing within the same day
const _sent = new Set();

function toYMD(d) {
  return d.toISOString().slice(0, 10);
}

async function checkPaymentReminders() {
  try {
    const today    = toYMD(new Date());
    const tomorrow = toYMD(new Date(Date.now() + 86_400_000));

    const [candidates] = await db.query(
      `SELECT ce.id,
              ce.full_name,
              ce.next_payment_date,
              ce.next_payment_amount,
              ce.salesperson_employee_id
       FROM candidate_enrollments ce
       WHERE ce.next_payment_date IS NOT NULL
         AND ce.salesperson_employee_id IS NOT NULL
         AND DATE(ce.next_payment_date) IN (?, ?)`,
      [today, tomorrow]
    );

    for (const c of candidates) {
      const payDate   = toYMD(new Date(c.next_payment_date));
      const dedupKey  = `${c.id}:${payDate}`;
      if (_sent.has(dedupKey)) continue;   // already notified today

      const isToday  = payDate === today;
      const label    = isToday ? 'Today' : 'Tomorrow';
      const amount   = c.next_payment_amount
        ? `$${parseFloat(c.next_payment_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        : 'an amount';

      await createNotification(db, {
        recipient_id: c.salesperson_employee_id,
        title:        `💳 Payment Due ${label}: ${c.full_name}`,
        body:         `Next instalment of ${amount} is due ${label.toLowerCase()} for candidate ${c.full_name}. Please follow up.`,
        type:         isToday ? 'warning' : 'info',
        entity_type:  'candidate_enrollment',
        entity_id:    c.id,
      });

      _sent.add(dedupKey);
      console.log(`[paymentReminder] Notified salesperson for ${c.full_name} — due ${label}`);

      // Also send email to the salesperson
      const [[salesperson]] = await db.query(
        'SELECT full_name, email FROM employees WHERE id = ?',
        [c.salesperson_employee_id]
      );
      if (salesperson) {
        await sendPaymentReminderEmail(salesperson, c, isToday ? 0 : 1);
      }
    }
  } catch (err) {
    console.error('[paymentReminder] Error:', err.message);
  }
}

/**
 * Start the scheduler. Fires immediately on startup, then every hour.
 */
function startPaymentReminderScheduler() {
  checkPaymentReminders(); // run once immediately
  setInterval(checkPaymentReminders, 60 * 60 * 1000); // then every 1 hour
  console.log('✅ Payment reminder scheduler started (checks every hour)');
}

module.exports = { startPaymentReminderScheduler, checkPaymentReminders };
