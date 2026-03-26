const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'root', password: 'Amoha@1234', database: 'recruithub'
  });

  const [tables] = await conn.query("SHOW TABLES");
  const tableNames = tables.map(r => Object.values(r)[0]);

  let tabsHtml = '';
  let contentHtml = '';

  for (const table of tableNames) {
    const [rows] = await conn.query(`SELECT * FROM \`${table}\` LIMIT 200`);
    const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
    const count = rows.length;

    tabsHtml += `<button class="tab-btn" onclick="showTab('${table}')" id="btn-${table}">${table} <span class="badge">${count}</span></button>`;

    let thead = cols.map(c => `<th>${c}</th>`).join('');
    let tbody = rows.map(row =>
      `<tr>${cols.map(c => `<td>${row[c] === null ? '<span class="null">NULL</span>' : String(row[c]).substring(0,80)}</td>`).join('')}</tr>`
    ).join('');

    contentHtml += `
    <div class="tab-content" id="tab-${table}" style="display:none">
      <h2>📋 ${table} <small>(${count} rows)</small></h2>
      <div class="table-wrap">
        <table><thead><tr>${thead}</tr></thead><tbody>${tbody || '<tr><td colspan="100" class="empty">No data</td></tr>'}</tbody></table>
      </div>
    </div>`;
  }

  await conn.end();

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>RecruitHUB — Database Viewer</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #0f1117; color: #e2e8f0; }
  header { background: linear-gradient(135deg,#1a4b3c,#0d3326); padding: 18px 28px; display:flex; align-items:center; gap:14px; border-bottom:1px solid #1e3d30; }
  header h1 { font-size:1.4rem; color:#4ade80; } header small { color:#94a3b8; font-size:.85rem; }
  .sidebar { position:fixed; top:70px; left:0; bottom:0; width:220px; background:#111827; border-right:1px solid #1f2937; overflow-y:auto; padding:10px 8px; }
  .tab-btn { display:block; width:100%; text-align:left; padding:9px 12px; margin-bottom:4px; background:#1e2535; border:none; color:#cbd5e1; border-radius:7px; cursor:pointer; font-size:.82rem; transition:all .15s; }
  .tab-btn:hover { background:#1e3a5f; color:#fff; }
  .tab-btn.active { background:#065f46; color:#4ade80; font-weight:600; }
  .badge { background:#374151; color:#9ca3af; border-radius:9px; padding:1px 6px; font-size:.72rem; float:right; }
  .tab-btn.active .badge { background:#064e3b; color:#34d399; }
  .main { margin-left:220px; padding:24px 28px; min-height:calc(100vh - 70px); }
  .tab-content h2 { font-size:1.2rem; color:#4ade80; margin-bottom:14px; }
  .tab-content h2 small { color:#6b7280; font-size:.8rem; font-weight:400; margin-left:8px; }
  .table-wrap { overflow-x:auto; border-radius:10px; border:1px solid #1f2937; }
  table { width:100%; border-collapse:collapse; font-size:.8rem; }
  thead tr { background:#1a2235; }
  th { padding:10px 12px; color:#7dd3fc; text-align:left; border-bottom:1px solid #1f2937; font-weight:600; white-space:nowrap; }
  td { padding:8px 12px; border-bottom:1px solid #111827; color:#cbd5e1; max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  tr:hover td { background:#1a2235; }
  .null { color:#4b5563; font-style:italic; }
  .empty { color:#4b5563; padding:20px; text-align:center; }
  #welcome { color:#6b7280; margin-top:80px; text-align:center; }
  #welcome h2 { font-size:2rem; color:#374151; } #welcome p { margin-top:10px; }
  ::-webkit-scrollbar{width:6px;height:6px} ::-webkit-scrollbar-track{background:#111} ::-webkit-scrollbar-thumb{background:#374151;border-radius:3px}
</style>
</head>
<body>
<header>
  <div>
    <h1>🗄️ RecruitHUB Database</h1>
    <small>MySQL · recruithub · ${tableNames.length} tables</small>
  </div>
</header>
<div class="sidebar">${tabsHtml}</div>
<div class="main">
  <div id="welcome"><h2>👆 Select a table</h2><p>Click any table from the sidebar to view its data</p></div>
  ${contentHtml}
</div>
<script>
  function showTab(name) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display='none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-'+name).style.display='block';
    document.getElementById('btn-'+name).classList.add('active');
    document.getElementById('welcome').style.display='none';
  }
  // Auto-open employees
  showTab('employees');
</script>
</body>
</html>`;

  const outPath = path.join('D:/Desktop/Amoha Pathfinder', 'db-viewer.html');
  fs.writeFileSync(outPath, html);
  console.log('DB viewer ready:', outPath);

  // Open in browser
  exec(`start "" "${outPath}"`);
}

main().catch(console.error);
