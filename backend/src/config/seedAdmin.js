/**
 * Creates the first Director account so you can log in.
 * Run once after setupDb.js:
 *   node src/config/seedAdmin.js
 */
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function seed() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'recruithub',
    multipleStatements: true,
  });

  // Get department + team IDs (created by schema.sql)
  const [[salesDept]] = await conn.query(
    `SELECT id FROM departments WHERE slug = 'sales' LIMIT 1`
  );
  if (!salesDept) {
    console.error('❌ Departments not found. Run setupDb.js first.');
    process.exit(1);
  }

  // Create a default team for Sales if none exists
  const [[existingTeam]] = await conn.query(
    `SELECT id FROM teams WHERE department_id = ? LIMIT 1`, [salesDept.id]
  );

  let teamId;
  if (existingTeam) {
    teamId = existingTeam.id;
  } else {
    teamId = uuidv4();
    await conn.query(
      `INSERT INTO teams (id, name, department_id) VALUES (?, 'Management', ?)`,
      [teamId, salesDept.id]
    );
  }

  const password = 'Admin@1234';
  const hash     = await bcrypt.hash(password, 12);
  const empId    = uuidv4();

  await conn.query(`
    INSERT INTO employees
      (id, employee_code, full_name, email, password_hash, role, department_id, team_id, joining_date)
    VALUES
      (?, 'DIR001', 'Admin Director', 'director@amoha.com', ?, 'director', ?, ?, CURDATE())
    ON DUPLICATE KEY UPDATE full_name = full_name
  `, [empId, hash, salesDept.id, teamId]);

  console.log('✅ Director account created!');
  console.log('');
  console.log('  Employee Code : DIR001');
  console.log('  Password      : Admin@1234');
  console.log('');
  console.log('Change this password after first login via HR Management.');

  await conn.end();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
