/**
 * Run this once after MySQL is installed:
 *   node src/config/setupDb.js
 *
 * It creates the database and all tables from sql/schema.sql
 */
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');
require('dotenv').config();

async function setup() {
  // Connect WITHOUT specifying a database (so we can create it)
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log('✅ Connected to MySQL');

  const schemaPath = path.join(__dirname, '../../sql/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('⏳ Running schema.sql...');
  await conn.query(sql);
  console.log('✅ Database and all tables created successfully!');
  console.log('');
  console.log('Next step: create your first director account by running:');
  console.log('  node src/config/seedAdmin.js');

  await conn.end();
}

setup().catch(err => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
