const path = require('path');
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const db = require('../config/db');
const { ok, created, notFound, badRequest, serverError } = require('../utils/response');

// ─── Multer config for document uploads ────────────────────────────────────────
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/documents');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  },
});
const documentUpload = multer({ storage: uploadStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── Multer config for avatar uploads ──────────────────────────────────────────
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/avatars');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${req.params.employee_id || uuidv4()}${ext}`);
  },
});
const avatarUpload = multer({ storage: avatarStorage, limits: { fileSize: 2 * 1024 * 1024 } });

// ─── HR Notices ────────────────────────────────────────────────────────────────

// GET /api/hr/notices
async function listNotices(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM hr_notices');

    const [rows] = await db.query(
      `SELECT n.*, e.full_name AS posted_by_name
       FROM hr_notices n
       LEFT JOIN employees e ON n.created_by_employee_id = e.id
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), offset]
    );

    return ok(res, rows, { total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/hr/notices
async function createNotice(req, res) {
  try {
    const { title, content } = req.body;
    if (!title || !content) return badRequest(res, 'title and content are required');

    const id = uuidv4();
    await db.query(
      `INSERT INTO hr_notices (id, title, content, created_by_employee_id)
       VALUES (?, ?, ?, ?)`,
      [id, title, content, req.employee.id]
    );

    const [[notice]] = await db.query('SELECT * FROM hr_notices WHERE id = ?', [id]);
    return created(res, notice);
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/hr/notices/:id
async function updateNotice(req, res) {
  try {
    const allowed = ['title','content'];
    const fields = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!fields.length) return badRequest(res, 'No valid fields to update');

    await db.query(
      `UPDATE hr_notices SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`,
      [...fields.map(f => req.body[f]), req.params.id]
    );

    const [[notice]] = await db.query('SELECT * FROM hr_notices WHERE id = ?', [req.params.id]);
    if (!notice) return notFound(res, 'Notice not found');
    return ok(res, notice);
  } catch (err) {
    return serverError(res, err);
  }
}

// DELETE /api/hr/notices/:id
async function deleteNotice(req, res) {
  try {
    const [[notice]] = await db.query('SELECT id FROM hr_notices WHERE id = ?', [req.params.id]);
    if (!notice) return notFound(res, 'Notice not found');

    await db.query('DELETE FROM hr_notices WHERE id = ?', [req.params.id]);
    return ok(res, { message: 'Notice deleted' });
  } catch (err) {
    return serverError(res, err);
  }
}

// ─── Salary History ────────────────────────────────────────────────────────────

// GET /api/hr/salary-history/:employee_id
async function salaryHistory(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT sh.*, e.full_name AS changed_by_name
       FROM salary_history sh
       LEFT JOIN employees e ON sh.changed_by_employee_id = e.id
       WHERE sh.employee_id = ?
       ORDER BY sh.created_at DESC`,
      [req.params.employee_id]
    );
    return ok(res, rows);
  } catch (err) {
    return serverError(res, err);
  }
}

// ─── Employee Documents ────────────────────────────────────────────────────────

// GET /api/hr/documents/:employee_id
async function listDocuments(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT * FROM employee_documents WHERE employee_id = ? ORDER BY created_at DESC`,
      [req.params.employee_id]
    );
    return ok(res, rows);
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/hr/documents/:employee_id  (multipart or JSON)
const uploadDocumentMiddleware = documentUpload.single('document');
async function uploadDocument(req, res) {
  uploadDocumentMiddleware(req, res, async (err) => {
    if (err) return badRequest(res, err.message);
    try {
      const document_type = req.body.document_type;
      if (!document_type) return badRequest(res, 'document_type is required');

      let file_url, file_name;
      if (req.file) {
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
        file_url  = `${baseUrl}/uploads/documents/${req.file.filename}`;
        file_name = req.file.originalname;
      } else {
        file_url  = req.body.file_url;
        file_name = req.body.file_name;
      }

      if (!file_url) return badRequest(res, 'file or file_url is required');

      const id = uuidv4();
      await db.query(
        `INSERT INTO employee_documents (id, employee_id, document_type, file_url, file_name)
         VALUES (?, ?, ?, ?, ?)`,
        [id, req.params.employee_id, document_type, file_url, file_name || null]
      );

      const [[doc]] = await db.query('SELECT * FROM employee_documents WHERE id = ?', [id]);
      return created(res, doc);
    } catch (e) {
      return serverError(res, e);
    }
  });
}

// DELETE /api/hr/documents/:employee_id/:doc_id
async function deleteDocument(req, res) {
  try {
    const { employee_id, doc_id } = req.params;
    const [[doc]] = await db.query(
      'SELECT * FROM employee_documents WHERE id = ? AND employee_id = ?',
      [doc_id, employee_id]
    );
    if (!doc) return notFound(res, 'Document not found');

    // Delete physical file if it's a local upload
    if (doc.file_url && doc.file_url.includes('/uploads/documents/')) {
      const filename = doc.file_url.split('/uploads/documents/').pop();
      const filePath = path.join(__dirname, '../../uploads/documents', filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await db.query('DELETE FROM employee_documents WHERE id = ?', [doc_id]);
    return ok(res, { message: 'Document deleted' });
  } catch (err) {
    return serverError(res, err);
  }
}

// ─── Shift Settings ────────────────────────────────────────────────────────────

// GET /api/hr/shifts
async function listShifts(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM shift_settings ORDER BY name ASC');
    return ok(res, rows);
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/hr/shifts
async function createShift(req, res) {
  try {
    const {
      name, start_time, end_time,
      grace_period_minutes = 10,
      required_hours = 8,
      max_late_per_month = 3,
    } = req.body;
    if (!name || !start_time || !end_time) {
      return badRequest(res, 'name, start_time, and end_time are required');
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO shift_settings (id, name, start_time, end_time, grace_period_minutes, required_hours, max_late_per_month)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, start_time, end_time, grace_period_minutes, required_hours, max_late_per_month]
    );

    const [[shift]] = await db.query('SELECT * FROM shift_settings WHERE id = ?', [id]);
    return created(res, shift);
  } catch (err) {
    return serverError(res, err);
  }
}

// ─── Office Locations ──────────────────────────────────────────────────────────

// GET /api/hr/office-locations
async function listOfficeLocations(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM office_locations ORDER BY name ASC');
    return ok(res, rows);
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/hr/office-locations
async function createOfficeLocation(req, res) {
  try {
    const { name, latitude, longitude, radius_meters = 200 } = req.body;
    if (!name || latitude === undefined || longitude === undefined) {
      return badRequest(res, 'name, latitude, and longitude are required');
    }

    const id = uuidv4();
    await db.query(
      'INSERT INTO office_locations (id, name, latitude, longitude, radius_meters) VALUES (?, ?, ?, ?, ?)',
      [id, name, latitude, longitude, radius_meters]
    );

    const [[loc]] = await db.query('SELECT * FROM office_locations WHERE id = ?', [id]);
    return created(res, loc);
  } catch (err) {
    return serverError(res, err);
  }
}

// ─── Leave Balance ─────────────────────────────────────────────────────────────

// GET /api/hr/leave-balance/:employee_id?year=
async function leaveBalance(req, res) {
  try {
    const year = req.query.year || new Date().getFullYear();
    const [rows] = await db.query(
      'SELECT * FROM leave_balance WHERE employee_id = ? AND year = ?',
      [req.params.employee_id, year]
    );
    return ok(res, rows);
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/employees/:employee_id/avatar  (multipart)
const avatarUploadMiddleware = avatarUpload.single('avatar');
async function uploadAvatar(req, res) {
  avatarUploadMiddleware(req, res, async (err) => {
    if (err) return badRequest(res, err.message);
    try {
      if (!req.file) return badRequest(res, 'No avatar file provided');

      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
      const avatar_url = `${baseUrl}/uploads/avatars/${req.file.filename}`;

      await db.query('UPDATE employees SET avatar_url = ? WHERE id = ?', [avatar_url, req.params.employee_id]);
      return ok(res, { avatar_url });
    } catch (e) {
      return serverError(res, e);
    }
  });
}

module.exports = {
  listNotices, createNotice, updateNotice, deleteNotice,
  salaryHistory,
  listDocuments, uploadDocument, deleteDocument, uploadAvatar,
  listShifts, createShift,
  listOfficeLocations, createOfficeLocation,
  leaveBalance,
};
