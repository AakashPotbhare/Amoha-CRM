/**
 * RecruitHUB Seed Script
 * Creates departments, teams, and all default employees
 * Run: node sql/seed.js
 */

require('dotenv').config();
const bcrypt  = require('bcryptjs');
const mysql   = require('mysql2/promise');

const db = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || 'Amoha@1234',
  database: process.env.DB_NAME     || 'recruithub',
  multipleStatements: true,
});

const DEFAULT_PASSWORD = 'Amoha@2026';

async function main() {
  console.log('🌱 Starting RecruitHUB seed...\n');

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  console.log('✅ Password hash generated');

  // ── Departments — read existing IDs (inserted by schema with UUID()) ─
  const [deptRows] = await db.query('SELECT id, slug FROM departments');
  const deptIds = {};
  for (const row of deptRows) deptIds[row.slug] = row.id;

  // Ensure all required departments exist
  const required = ['management','operations','sales','resume','marketing','technical','compliance'];
  const names    = {
    management:'Management',
    operations:'Operations',
    sales:'Sales',
    resume:'Resume',
    marketing:'Marketing',
    technical:'Technical',
    compliance:'Compliance',
  };
  for (const slug of required) {
    if (!deptIds[slug]) {
      const [r] = await db.query('INSERT INTO departments (id,name,slug) VALUES (UUID(),?,?)', [names[slug], slug]);
      const [[d]] = await db.query('SELECT id FROM departments WHERE slug=?', [slug]);
      deptIds[slug] = d.id;
    }
  }
  console.log('✅ Departments ready:', JSON.stringify(deptIds));

  // ── Teams ──────────────────────────────────────────────────────────
  const teamDefs = [
    { key: 'mgmt',  name: 'Management',           dept: 'management' },
    { key: 'ops1',  name: 'Operations',           dept: 'operations' },
    { key: 'sal1',  name: 'Sales Team',           dept: 'sales'      },
    { key: 'res1',  name: 'Resume Team',          dept: 'resume'     },
    { key: 'mkt1',  name: 'Marketing Team 1',     dept: 'marketing'  },
    { key: 'mkt2',  name: 'Marketing Team 2',     dept: 'marketing'  },
    { key: 'mkt3',  name: 'Marketing Team 3',     dept: 'marketing'  },
    { key: 'mkt4',  name: 'Marketing Team 4',     dept: 'marketing'  },
    { key: 'tec1',  name: 'Technical Team A',     dept: 'technical'  },
    { key: 'tec2',  name: 'Technical Team B',     dept: 'technical'  },
    { key: 'com1',  name: 'Compliance Team',      dept: 'compliance' },
  ];

  const teamIds = {};
  for (const t of teamDefs) {
    // Check if a team with this name already exists in this dept
    const [[existing]] = await db.query(
      'SELECT id FROM teams WHERE name = ? AND department_id = ?',
      [t.name, deptIds[t.dept]]
    );
    if (existing) {
      teamIds[t.key] = existing.id;
    } else {
      await db.query(
        'INSERT INTO teams (id, name, department_id) VALUES (UUID(), ?, ?)',
        [t.name, deptIds[t.dept]]
      );
      const [[inserted]] = await db.query(
        'SELECT id FROM teams WHERE name = ? AND department_id = ?',
        [t.name, deptIds[t.dept]]
      );
      teamIds[t.key] = inserted.id;
    }
  }
  console.log('✅ Teams seeded');

  // ── Employees ──────────────────────────────────────────────────────
  const employees = [
    // ── Directors (3) ──
    { full_name:'Ashish Dabhi',        email:'ashish.dabhi@amoha.com',      designation:'Director',            dept:'management', team:'mgmt', role:'director'            },
    { full_name:'Karan Sharma',         email:'karan.sharma@amoha.com',      designation:'Director',            dept:'management', team:'mgmt', role:'director'            },
    { full_name:'Manthan Patel',        email:'manthan.patel@amoha.com',     designation:'Director',            dept:'management', team:'mgmt', role:'director'            },

    // ── Operations & HR Heads (same level, report to Directors) ──
    { full_name:'Tripesh Koneru',       email:'tripesh.koneru@amoha.com',    designation:'Operations Head',     dept:'operations', team:'ops1', role:'ops_head'            },
    { full_name:'BalKishan Tiwari',     email:'balkishan.tiwari@amoha.com',  designation:'HR Head',             dept:'compliance', team:'com1', role:'hr_head'             },

    // ── Sales (under Operations Head) ──
    { full_name:'Vishesh Shah',         email:'vishesh.shah@amoha.com',      designation:'Sales Head',          dept:'sales',      team:'sal1', role:'sales_head'          },
    { full_name:'Parth Thakkar',        email:'parth.thakkar@amoha.com',     designation:'Assistant Team Lead', dept:'sales',      team:'sal1', role:'assistant_tl'        },
    { full_name:'Khushboo Chaudhary',   email:'khushboo.chaudhary@amoha.com',designation:'Sales Executive',     dept:'sales',      team:'sal1', role:'sales_executive'     },

    // ── Technical (under Operations Head) ──
    { full_name:'Aakash Potbhare',      email:'aakash.potbhare@amoha.com',   designation:'Technical Head',      dept:'technical',  team:'tec1', role:'technical_head'      },
    { full_name:'Prateek Makwana',      email:'prateek.makwana@amoha.com',   designation:'Technical Executive', dept:'technical',  team:'tec1', role:'technical_executive' },
    { full_name:'Archie Geda',          email:'archie.geda@amoha.com',       designation:'Technical Executive', dept:'technical',  team:'tec1', role:'technical_executive' },
    { full_name:'Deep Patel',           email:'deep.patel@amoha.com',        designation:'Technical Executive', dept:'technical',  team:'tec1', role:'technical_executive' },
    { full_name:'Aarti Vishwakarma',    email:'aarti.vishwakarma@amoha.com', designation:'Technical Executive', dept:'technical',  team:'tec2', role:'technical_executive' },
    { full_name:'Anusha Pandey',        email:'anusha.pandey@amoha.com',     designation:'Technical Executive', dept:'technical',  team:'tec2', role:'technical_executive' },
    { full_name:'Shital Yadav',         email:'shital.yadav@amoha.com',      designation:'Technical Executive', dept:'technical',  team:'tec2', role:'technical_executive' },

    // ── Resume (under Operations Head) ──
    { full_name:'Yogesh Jadoun',        email:'yogesh.jadoun@amoha.com',     designation:'Resume Head',         dept:'resume',     team:'res1', role:'resume_head'         },

    // ── Compliance (under Operations Head) ──
    { full_name:'Gaurav Garg',          email:'gaurav.garg@amoha.com',       designation:'Compliance Officer',  dept:'compliance', team:'com1', role:'compliance_officer'  },

    // ── Marketing (4 Teams, under Operations Head) ──
    { full_name:'Aditya Singh',         email:'aditya.singh@amoha.com',      designation:'Marketing Team Lead', dept:'marketing',  team:'mkt1', role:'marketing_tl'        },
    { full_name:'Bhavith Nethani',      email:'bhavith.nethani@amoha.com',   designation:'Marketing Team Lead', dept:'marketing',  team:'mkt2', role:'marketing_tl'        },
    { full_name:'Yesh Shah',            email:'yesh.shah@amoha.com',         designation:'Marketing Team Lead', dept:'marketing',  team:'mkt3', role:'marketing_tl'        },
    { full_name:'Aman Pandey',          email:'aman.pandey@amoha.com',       designation:'Marketing Team Lead', dept:'marketing',  team:'mkt4', role:'marketing_tl'        },
  ];

  employees.forEach((emp, index) => {
    emp.employee_code = `ARS${String(index + 1).padStart(5, '0')}`;
  });

  let created = 0;
  for (const emp of employees) {
    await db.query(
      `INSERT INTO employees
         (id, employee_code, full_name, email, password_hash, designation,
          department_id, team_id, role, is_active, joining_date)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, 1, CURDATE())
       ON DUPLICATE KEY UPDATE
         full_name = VALUES(full_name),
         password_hash = VALUES(password_hash),
         is_active = 1`,
      [emp.employee_code, emp.full_name, emp.email, hash,
       emp.designation, deptIds[emp.dept], teamIds[emp.team], emp.role]
    );
    created++;
  }
  console.log(`✅ ${created} employees seeded (all passwords: ${DEFAULT_PASSWORD})`);

  // ── Leave balances ─────────────────────────────────────────────────
  for (const emp of employees) {
    const [[empRow]] = await db.query('SELECT id FROM employees WHERE employee_code = ?', [emp.employee_code]);
    if (empRow) {
      await db.query(
        `INSERT IGNORE INTO leave_balance (id, employee_id, year, paid_leave_credited, paid_leave_used, unpaid_leave_used)
         VALUES (UUID(), ?, YEAR(CURDATE()), 24, 0, 0)`,
        [empRow.id]
      );
    }
  }
  console.log('✅ Leave balances created');

  console.log('\n🎉 Seed complete!\n');
  console.log('Employee Codes:');
  for (const emp of employees) {
    console.log(`  ${emp.employee_code.padEnd(8)} ${emp.role.padEnd(25)} ${emp.full_name}`);
  }
  console.log(`\nAll passwords: ${DEFAULT_PASSWORD}`);

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
