require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path      = require('path');
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet({
  // Allow uploaded files (PDFs, images, etc.) to be opened cross-origin
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Relax CSP for API server — no HTML pages served here
  contentSecurityPolicy: false,
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman) and listed origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ─── Static files — serve uploads with cross-origin headers ───────────────────
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}, express.static(path.join(__dirname, '../uploads')));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 login attempts per 15 min
  message: { success: false, error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',            require('./routes/auth.routes'));
app.use('/api/candidates',      require('./routes/candidates.routes'));
app.use('/api/support-tasks',   require('./routes/supportTasks.routes'));
app.use('/api/tasks',           require('./routes/tasks.routes'));
app.use('/api/attendance',      require('./routes/attendance.routes'));
app.use('/api/leaves',          require('./routes/leaves.routes'));
app.use('/api/employees',       require('./routes/employees.routes'));
app.use('/api/hr',              require('./routes/hr.routes'));
app.use('/api/notifications',     require('./routes/notifications.routes'));
app.use('/api/placement-orders', require('./routes/placementOffers.routes'));
app.use('/api/analytics',       require('./routes/analytics.routes'));
app.use('/api/chat',            require('./routes/chat.routes'));

// ─── Top-level meta aliases (departments, teams) ───────────────────────────
// Mounted separately so /api/departments and /api/teams work without the
// /employees prefix that CreateTask, CreateSupportTask, HRDashboard expect.
const { authenticate } = require('./middleware/auth');
const empCtrl = require('./controllers/employees.controller');
const metaRouter = require('express').Router();
metaRouter.use(authenticate);
metaRouter.get('/departments', empCtrl.departments);
metaRouter.get('/teams',       empCtrl.teams);
app.use('/api', metaRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ RecruitHUB API running on http://localhost:${PORT}`);

  // Start background schedulers
  const { startPaymentReminderScheduler } = require('./services/paymentReminder.service');
  startPaymentReminderScheduler();
});

module.exports = app;
