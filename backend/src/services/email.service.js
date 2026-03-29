/**
 * Email Service (Nodemailer)
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends transactional emails for RecruitHUB.
 * Reads SMTP config from environment variables.
 * Gracefully degrades — if EMAIL_USER is not set, skips sending and logs a warning.
 */

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
  console.warn('⚠️  nodemailer not installed. Run: cd backend && npm install nodemailer');
}

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:8080').split(',')[0].trim();
const FROM_ADDRESS = process.env.EMAIL_FROM || 'RecruitHUB <no-reply@recruithub.com>';

/** Create a transporter lazily so missing env vars don't crash on startup */
function getTransporter() {
  if (!nodemailer) return null;
  if (!process.env.EMAIL_USER) {
    console.warn('⚠️  EMAIL_USER not set — email sending is disabled. Add EMAIL_USER to .env to enable.');
    return null;
  }
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

/**
 * Core send function. Never throws — logs errors and continues.
 * @param {{ to: string, subject: string, html: string, text?: string }} opts
 */
async function sendEmail({ to, subject, html, text }) {
  if (!to) return;
  const transporter = getTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({ from: FROM_ADDRESS, to, subject, html, text: text || '' });
    console.log(`📧 Email sent to: ${to} — ${subject}`);
  } catch (err) {
    console.error(`📧 Email failed (to: ${to}, subject: ${subject}):`, err.message);
  }
}

// ─── HTML base template ───────────────────────────────────────────────────────
function baseHtml(content) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: #18181b; padding: 24px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; }
    .header p  { color: #a1a1aa; margin: 4px 0 0; font-size: 13px; }
    .body   { padding: 32px; color: #18181b; }
    .footer { padding: 20px 32px; background: #f4f4f5; border-top: 1px solid #e4e4e7; }
    .footer p { margin: 0; font-size: 12px; color: #71717a; }
    .badge  { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .badge-success  { background: #dcfce7; color: #16a34a; }
    .badge-warning  { background: #fef9c3; color: #ca8a04; }
    .badge-danger   { background: #fee2e2; color: #dc2626; }
    .badge-info     { background: #dbeafe; color: #2563eb; }
    .field  { margin-bottom: 16px; }
    .field-label { font-size: 11px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .field-value { font-size: 15px; color: #18181b; font-weight: 500; }
    .btn { display: inline-block; padding: 12px 24px; background: #18181b; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 8px; }
    .divider { border: none; border-top: 1px solid #e4e4e7; margin: 24px 0; }
    h2 { margin: 0 0 20px; font-size: 18px; }
    p  { margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #3f3f46; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>RecruitHUB</h1>
      <p>Amoha Recruitment Services</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>This is an automated email from RecruitHUB. Please do not reply.</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Template: Payment Reminder ──────────────────────────────────────────────
async function sendPaymentReminderEmail(employee, candidate, daysUntil) {
  if (!employee?.email) return;

  const isToday  = daysUntil === 0;
  const dueLine  = isToday ? '<strong>TODAY</strong>' : 'Tomorrow';
  const amount   = candidate.next_payment_amount
    ? `$${parseFloat(candidate.next_payment_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : 'an amount';
  const dueDate  = candidate.next_payment_date
    ? new Date(candidate.next_payment_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  const html = baseHtml(`
    <h2>💳 Payment Due ${isToday ? 'TODAY' : 'Tomorrow'}</h2>
    <p>Hi ${employee.full_name},</p>
    <p>This is a reminder that the following payment is due <strong>${dueLine}</strong>:</p>
    <hr class="divider">
    <div class="field"><div class="field-label">Candidate</div><div class="field-value">${candidate.full_name}</div></div>
    <div class="field"><div class="field-label">Amount Due</div><div class="field-value" style="font-size:20px;color:#18181b">${amount}</div></div>
    <div class="field"><div class="field-label">Due Date</div><div class="field-value">${dueDate}</div></div>
    <hr class="divider">
    ${isToday
      ? '<p><span class="badge badge-danger">⚠ Payment Due Today</span></p><p>Please follow up with the candidate immediately to collect the payment.</p>'
      : '<p><span class="badge badge-warning">📅 Payment Due Tomorrow</span></p><p>Please prepare to follow up with the candidate tomorrow.</p>'
    }
  `);

  await sendEmail({
    to: employee.email,
    subject: `💳 Payment Due ${isToday ? 'TODAY' : 'Tomorrow'} — ${candidate.full_name}`,
    html,
  });
}

// ─── Template: Leave Status ───────────────────────────────────────────────────
async function sendLeaveStatusEmail(employeeEmail, employeeName, leaveRequest, status, rejectionReason) {
  if (!employeeEmail) return;

  const isApproved = status === 'approved';
  const fromDate   = new Date(leaveRequest.from_date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  const toDate     = new Date(leaveRequest.to_date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  const leaveType  = leaveRequest.leave_type.charAt(0).toUpperCase() + leaveRequest.leave_type.slice(1);

  const html = baseHtml(`
    <h2>Leave Request ${isApproved ? 'Approved ✓' : 'Rejected ✗'}</h2>
    <p>Hi ${employeeName},</p>
    <p>Your leave request has been <strong>${isApproved ? 'approved' : 'rejected'}</strong>.</p>
    <hr class="divider">
    <div class="field"><div class="field-label">Leave Type</div><div class="field-value">${leaveType} Leave</div></div>
    <div class="field"><div class="field-label">From</div><div class="field-value">${fromDate}</div></div>
    <div class="field"><div class="field-label">To</div><div class="field-value">${toDate}</div></div>
    <div class="field"><div class="field-label">Total Days</div><div class="field-value">${leaveRequest.total_days} day${leaveRequest.total_days !== 1 ? 's' : ''}</div></div>
    <hr class="divider">
    <p><span class="badge ${isApproved ? 'badge-success' : 'badge-danger'}">${isApproved ? '✓ Approved' : '✗ Rejected'}</span></p>
    ${!isApproved && rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
    ${isApproved ? '<p>Your leave has been approved. Please ensure your work is handed over before your leave starts.</p>' : '<p>If you have questions about this decision, please contact your manager.</p>'}
  `);

  await sendEmail({
    to: employeeEmail,
    subject: `Leave Request ${isApproved ? 'Approved ✓' : 'Rejected ✗'} — ${leaveType} (${leaveRequest.total_days} day${leaveRequest.total_days !== 1 ? 's' : ''})`,
    html,
  });
}

// ─── Template: Welcome Email ──────────────────────────────────────────────────
async function sendWelcomeEmail(employee, temporaryPassword) {
  if (!employee?.email) return;

  const loginUrl = FRONTEND_URL;
  const html = baseHtml(`
    <h2>Welcome to RecruitHUB! 🎉</h2>
    <p>Hi ${employee.full_name},</p>
    <p>Your account has been created. Here are your login details:</p>
    <hr class="divider">
    <div class="field"><div class="field-label">Employee Code</div><div class="field-value" style="font-family:monospace;font-size:18px;letter-spacing:2px">${employee.employee_code}</div></div>
    <div class="field"><div class="field-label">Temporary Password</div><div class="field-value" style="font-family:monospace;font-size:18px;letter-spacing:2px">${temporaryPassword}</div></div>
    <div class="field"><div class="field-label">Role</div><div class="field-value">${employee.role?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div></div>
    <hr class="divider">
    <p><strong>Please change your password after your first login.</strong></p>
    <a href="${loginUrl}" class="btn">Login to RecruitHUB →</a>
    <p style="margin-top:20px;font-size:12px;color:#71717a">If you did not expect this email, please contact your HR team.</p>
  `);

  await sendEmail({
    to: employee.email,
    subject: `Welcome to RecruitHUB — Your Login Details`,
    html,
  });
}

// ─── Template: Password Reset ─────────────────────────────────────────────────
async function sendPasswordResetEmail(employee, resetToken) {
  if (!employee?.email) return;

  const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
  const html = baseHtml(`
    <h2>Reset Your Password 🔑</h2>
    <p>Hi ${employee.full_name},</p>
    <p>We received a request to reset the password for your RecruitHUB account (<strong>${employee.employee_code}</strong>).</p>
    <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
    <a href="${resetUrl}" class="btn">Reset Password →</a>
    <hr class="divider">
    <p style="font-size:12px;color:#71717a">If you did not request a password reset, you can safely ignore this email. Your password will not change.</p>
    <p style="font-size:12px;color:#71717a">Or copy this link: <a href="${resetUrl}" style="color:#2563eb;word-break:break-all">${resetUrl}</a></p>
  `);

  await sendEmail({
    to: employee.email,
    subject: `Reset Your RecruitHUB Password`,
    html,
  });
}

module.exports = {
  sendEmail,
  sendPaymentReminderEmail,
  sendLeaveStatusEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
};
