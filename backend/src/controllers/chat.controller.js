const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { ok, created, notFound, badRequest, forbidden, serverError } = require('../utils/response');

/* ────────────────────────────────────────────────────────────
   GET /api/chat
   List all conversations for the current user
   ──────────────────────────────────────────────────────────── */
exports.listConversations = async (req, res) => {
  try {
    const me = req.employee.id;

    const [rows] = await db.query(
      `SELECT
         c.id,
         c.participant_one,
         c.participant_two,
         c.last_message_at,
         c.created_at,
         -- other participant details
         e.id            AS other_id,
         e.full_name     AS other_full_name,
         e.avatar_url    AS other_avatar_url,
         e.designation   AS other_designation,
         e.employee_code AS other_employee_code,
         d.name          AS other_department_name,
         -- last message
         lm.content      AS last_message,
         lm.file_name    AS last_file_name,
         lm.created_at   AS last_message_created_at,
         -- unread count
         COALESCE(ur.unread_count, 0) AS unread_count
       FROM chat_conversations c
       JOIN employees e
         ON e.id = IF(c.participant_one = ?, c.participant_two, c.participant_one)
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN LATERAL (
         SELECT cm.content, cm.file_name, cm.created_at
         FROM chat_messages cm
         WHERE cm.conversation_id = c.id
         ORDER BY cm.created_at DESC
         LIMIT 1
       ) lm ON TRUE
       LEFT JOIN (
         SELECT conversation_id, COUNT(*) AS unread_count
         FROM chat_messages
         WHERE sender_id != ? AND is_read = FALSE
         GROUP BY conversation_id
       ) ur ON ur.conversation_id = c.id
       WHERE c.participant_one = ? OR c.participant_two = ?
       ORDER BY c.last_message_at DESC`,
      [me, me, me, me]
    );

    // Map flat columns to nested `other_employee` shape the frontend expects
    const conversations = rows.map(r => ({
      id: r.id,
      participant_one: r.participant_one,
      participant_two: r.participant_two,
      last_message_at: r.last_message_at,
      created_at: r.created_at,
      other_employee: {
        id: r.other_id,
        full_name: r.other_full_name,
        avatar_url: r.other_avatar_url,
        designation: r.other_designation,
        employee_code: r.other_employee_code,
        department_name: r.other_department_name,
      },
      last_message: r.last_message || (r.last_file_name ? `📎 ${r.last_file_name}` : null),
      unread_count: Number(r.unread_count),
    }));

    const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

    return ok(res, conversations, { total_unread: totalUnread });
  } catch (err) {
    return serverError(res, err);
  }
};

/* ────────────────────────────────────────────────────────────
   GET /api/chat/:conversationId/messages
   Fetch messages & mark the other person's messages as read
   ──────────────────────────────────────────────────────────── */
exports.getMessages = async (req, res) => {
  try {
    const me = req.employee.id;
    const { conversationId } = req.params;

    // Verify participation
    const [[conv]] = await db.query(
      `SELECT id, participant_one, participant_two
       FROM chat_conversations WHERE id = ?`,
      [conversationId]
    );

    if (!conv) return notFound(res, 'Conversation not found');
    if (conv.participant_one !== me && conv.participant_two !== me) {
      return forbidden(res, 'You are not a participant in this conversation');
    }

    // Mark other person's messages as read
    await db.query(
      `UPDATE chat_messages
       SET is_read = TRUE
       WHERE conversation_id = ? AND sender_id != ? AND is_read = FALSE`,
      [conversationId, me]
    );

    // Fetch all messages
    const [messages] = await db.query(
      `SELECT id, conversation_id, sender_id, content, file_url, file_name, is_read, created_at
       FROM chat_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`,
      [conversationId]
    );

    return ok(res, messages);
  } catch (err) {
    return serverError(res, err);
  }
};

/* ────────────────────────────────────────────────────────────
   POST /api/chat/:conversationId/messages
   Send a message in an existing conversation
   ──────────────────────────────────────────────────────────── */
exports.sendMessage = async (req, res) => {
  try {
    const me = req.employee.id;
    const { conversationId } = req.params;
    const { content, file_url, file_name } = req.body;

    if (!content && !file_url) {
      return badRequest(res, 'Message must have content or a file');
    }

    // Verify participation
    const [[conv]] = await db.query(
      `SELECT id, participant_one, participant_two
       FROM chat_conversations WHERE id = ?`,
      [conversationId]
    );

    if (!conv) return notFound(res, 'Conversation not found');
    if (conv.participant_one !== me && conv.participant_two !== me) {
      return forbidden(res, 'You are not a participant in this conversation');
    }

    const msgId = uuidv4();
    await db.query(
      `INSERT INTO chat_messages (id, conversation_id, sender_id, content, file_url, file_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [msgId, conversationId, me, content || null, file_url || null, file_name || null]
    );

    // Update last_message_at
    await db.query(
      `UPDATE chat_conversations SET last_message_at = NOW() WHERE id = ?`,
      [conversationId]
    );

    const [[newMsg]] = await db.query(
      `SELECT id, conversation_id, sender_id, content, file_url, file_name, is_read, created_at
       FROM chat_messages WHERE id = ?`,
      [msgId]
    );

    return created(res, newMsg);
  } catch (err) {
    return serverError(res, err);
  }
};

/* ────────────────────────────────────────────────────────────
   POST /api/chat/start
   Start (or resume) a conversation with another employee
   ──────────────────────────────────────────────────────────── */
exports.startConversation = async (req, res) => {
  try {
    const me = req.employee.id;
    const { employee_id } = req.body;

    if (!employee_id) return badRequest(res, 'employee_id is required');
    if (employee_id === me) return badRequest(res, 'Cannot start a conversation with yourself');

    // Ensure target employee exists
    const [[target]] = await db.query(
      `SELECT e.id, e.full_name, e.avatar_url, e.designation, e.employee_code, d.name AS department_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.id = ? AND e.is_active = 1`,
      [employee_id]
    );
    if (!target) return notFound(res, 'Employee not found or inactive');

    // Check if conversation already exists (either ordering)
    const [[existing]] = await db.query(
      `SELECT id, participant_one, participant_two, last_message_at, created_at
       FROM chat_conversations
       WHERE (participant_one = ? AND participant_two = ?)
          OR (participant_one = ? AND participant_two = ?)`,
      [me, employee_id, employee_id, me]
    );

    if (existing) {
      return ok(res, {
        id: existing.id,
        participant_one: existing.participant_one,
        participant_two: existing.participant_two,
        last_message_at: existing.last_message_at,
        other_employee: target,
      });
    }

    // Ensure consistent ordering for the unique key
    const p1 = me < employee_id ? me : employee_id;
    const p2 = me < employee_id ? employee_id : me;
    const convId = uuidv4();

    await db.query(
      `INSERT INTO chat_conversations (id, participant_one, participant_two)
       VALUES (?, ?, ?)`,
      [convId, p1, p2]
    );

    const [[newConv]] = await db.query(
      `SELECT id, participant_one, participant_two, last_message_at, created_at
       FROM chat_conversations WHERE id = ?`,
      [convId]
    );

    return created(res, {
      id: newConv.id,
      participant_one: newConv.participant_one,
      participant_two: newConv.participant_two,
      last_message_at: newConv.last_message_at,
      other_employee: target,
    });
  } catch (err) {
    return serverError(res, err);
  }
};

/* ────────────────────────────────────────────────────────────
   POST /api/chat/upload
   Upload a file for chat (multer handled in routes)
   ──────────────────────────────────────────────────────────── */
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) return badRequest(res, 'No file uploaded');

    // Return full absolute URL so the frontend can open it directly
    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`;
    const url = `${baseUrl}/uploads/chat/${req.file.filename}`;
    const name = req.file.originalname;

    return ok(res, { url, name });
  } catch (err) {
    return serverError(res, err);
  }
};
