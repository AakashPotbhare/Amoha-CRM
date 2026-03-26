/**
 * Full role-chain audit: Marketing, Technical, HR/Resume/Compliance, Ops, Directors
 */
const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 4000, path, method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch(e) { resolve({ status: res.statusCode, body: {} }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login(code) {
  const r = await request('POST', '/api/auth/login', { employeeCode: code, password: 'Amoha@2026' });
  if (!r.body?.data?.token) throw new Error(`Login failed for ${code}: ${JSON.stringify(r.body)}`);
  return { token: r.body.data.token, emp: r.body.data.employee };
}

function pass(msg) { return `  ✅ ${msg}`; }
function fail(msg) { return `  ❌ ${msg}`; }
function warn(msg) { return `  ⚠️  ${msg}`; }

async function main() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  RecruitHUB Full Role-Chain Audit');
  console.log('══════════════════════════════════════════════════\n');

  // Login all users
  const users = {};
  const codes = { MKT001:'Aditya Singh', MKT002:'Bhavith Nethani', TEC001:'Aakash Potbhare',
                  TEC002:'Prateek Makwana', HR001:'BalKishan Tiwari', RES001:'Yogesh Jadoun',
                  COM001:'Gaurav Garg', OPS001:'Tripesh Koneru', DIR001:'Ashish Dabhi', SAL003:'Khushboo' };
  for (const [code, name] of Object.entries(codes)) {
    users[code] = await login(code);
    users[code].name = name;
  }
  console.log(`Logged in ${Object.keys(users).length} users ✅\n`);

  // Get a candidate ID for testing
  const candR = await request('GET', '/api/candidates?limit=1', null, users.DIR001.token);
  const candidateId = candR.body?.data?.[0]?.id;
  console.log(`Test candidate ID: ${candidateId || 'NONE (no candidates in DB)'}\n`);

  // ── CHAIN 1: MARKETING ─────────────────────────────────────────────
  console.log('━━━ MARKETING CHAIN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1a. Aditya Singh (marketing_tl) - create support task
  console.log('▸ Aditya Singh (MKT001 - marketing_tl)');
  const stCreate = await request('POST', '/api/support-tasks', {
    task_type: 'interview_support',
    candidate_id: candidateId,
    scheduled_at: '2026-04-01T10:00:00Z',
    notes: 'Audit test task'
  }, users.MKT001.token);
  console.log(stCreate.status === 201 ? pass(`Create interview_support task: 201`) : fail(`Create support task: ${stCreate.status} — ${stCreate.body?.error}`));
  const taskId = stCreate.body?.data?.id;

  const stList = await request('GET', '/api/support-tasks', null, users.MKT001.token);
  console.log(stList.status === 200 ? pass(`List support tasks: ${stList.body?.data?.total ?? 0} visible`) : fail(`List support tasks: ${stList.status} — ${stList.body?.error}`));

  const poList = await request('GET', '/api/placement-orders', null, users.MKT001.token);
  console.log(poList.status === 200 ? pass(`View placement orders: ${poList.body?.data?.length ?? 0} records`) : fail(`Placement orders: ${poList.status} — ${poList.body?.error}`));

  const poCreate = await request('POST', '/api/placement-orders', {
    candidate_name: 'Test Candidate', technology: 'React', offer_position: 'Frontend Dev',
    employer_name: 'Test Corp', offer_date: '2026-03-24', annual_package: 800000,
    upfront_paid: 0, commission_amount: 80000, final_amount_due: 80000, employment_type: 'full_time'
  }, users.MKT001.token);
  console.log(poCreate.status === 201 ? pass(`Create placement order: 201`) : fail(`Create PO: ${poCreate.status} — ${poCreate.body?.error}`));

  const mktLeave = await request('GET', '/api/leaves/pending-tl', null, users.MKT001.token);
  console.log(mktLeave.status === 200 ? pass(`Marketing TL see pending leaves: count=${mktLeave.body?.data?.length}`) : fail(`Marketing TL pending-tl: ${mktLeave.status} — ${mktLeave.body?.error}`));

  const mktAnalytics = await request('GET', '/api/analytics/departments/marketing/summary', null, users.MKT001.token);
  console.log(mktAnalytics.status === 200 ? pass(`Dept analytics /marketing/summary: OK`) : fail(`Marketing analytics: ${mktAnalytics.status} — ${mktAnalytics.body?.error}`));

  const mktCands = await request('GET', '/api/candidates', null, users.MKT001.token);
  console.log(mktCands.status === 200 ? pass(`Candidates visible to marketing TL: ${mktCands.body?.data?.length ?? 0}`) : fail(`Candidates: ${mktCands.status}`));
  if (mktCands.body?.data?.length > 0 && mktCands.body.data[0].password_hash) {
    console.log(warn('Candidate list exposes password_hash field — not applicable here but check sensitive fields'));
  }

  // Check if candidate history works
  if (candidateId) {
    const hist = await request('GET', `/api/analytics/candidate/${candidateId}/history`, null, users.MKT001.token);
    console.log(hist.status === 200 ? pass(`Candidate history for ${candidateId}: OK (${hist.body?.data?.history?.length ?? 0} events)`) : fail(`Candidate history: ${hist.status} — ${hist.body?.error}`));
  }

  // 1b. Can MKT001 see tasks as created-by?
  if (taskId) {
    const stOwn = await request('GET', '/api/support-tasks', null, users.MKT001.token);
    const visible = stOwn.body?.data?.rows?.some?.(t => t.id === taskId) || stOwn.body?.data?.total > 0;
    console.log(visible ? pass(`Created support task appears in own list`) : warn(`Created task NOT in own list — tracking gap (created_by scope missing)`));
  }

  // ── CHAIN 2: TECHNICAL ─────────────────────────────────────────────
  console.log('\n━━━ TECHNICAL CHAIN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 2a. Prateek Makwana (technical_executive) — sees tasks assigned to him
  console.log('▸ Prateek Makwana (TEC002 - technical_executive)');

  // Assign the task created above to Prateek
  if (taskId) {
    const prateekEmpId = users.TEC002.emp?.id;
    const assign = await request('PATCH', `/api/support-tasks/${taskId}/reassign`,
      { assigned_to_employee_id: prateekEmpId }, users.MKT001.token);
    console.log(assign.status === 200 ? pass(`Task reassigned to Prateek: OK`) : warn(`Reassign task: ${assign.status} — ${assign.body?.error}`));
  }

  const prateekTasks = await request('GET', '/api/support-tasks', null, users.TEC002.token);
  console.log(prateekTasks.status === 200
    ? pass(`Prateek sees support tasks: ${prateekTasks.body?.data?.total ?? 0} total`)
    : fail(`Prateek support tasks: ${prateekTasks.status} — ${prateekTasks.body?.error}`));

  // Prateek updates call status
  if (taskId) {
    const callUpd = await request('PATCH', `/api/support-tasks/${taskId}/call-status`,
      { call_status: 'completed', feedback: 'Candidate performed well in the technical round' }, users.TEC002.token);
    console.log(callUpd.status === 200 ? pass(`Prateek updates call_status to completed`) : fail(`call-status update: ${callUpd.status} — ${callUpd.body?.error}`));
  }

  // Prateek sees own performance
  const prateekPerf = await request('GET', `/api/analytics/employee/${users.TEC002.emp?.id}/performance`, null, users.TEC002.token);
  console.log(prateekPerf.status === 200 ? pass(`Prateek performance analytics: OK`) : fail(`Prateek performance: ${prateekPerf.status} — ${prateekPerf.body?.error}`));

  // Can Prateek see candidates? (security concern)
  const prateekCands = await request('GET', '/api/candidates', null, users.TEC002.token);
  console.log(prateekCands.status === 200
    ? warn(`Technical executive can see ALL candidates (${prateekCands.body?.data?.length ?? 0}) — no scope restriction`)
    : pass(`Candidates scoped away from technical executive: ${prateekCands.status}`));

  // 2b. Aakash Potbhare (technical_head)
  console.log('\n▸ Aakash Potbhare (TEC001 - technical_head)');

  const aakashTasks = await request('GET', '/api/support-tasks', null, users.TEC001.token);
  console.log(aakashTasks.status === 200
    ? pass(`Aakash sees support tasks: ${aakashTasks.body?.data?.total ?? 0}`)
    : fail(`Aakash support tasks: ${aakashTasks.status} — ${aakashTasks.body?.error}`));

  const aakashLeave = await request('GET', '/api/leaves/pending-tl', null, users.TEC001.token);
  console.log(aakashLeave.status === 200
    ? pass(`Aakash pending team leaves: count=${aakashLeave.body?.data?.length}`)
    : fail(`Aakash pending-tl: ${aakashLeave.status} — ${aakashLeave.body?.error}`));

  const aakashAnalytics = await request('GET', '/api/analytics/departments/technical/summary', null, users.TEC001.token);
  console.log(aakashAnalytics.status === 200
    ? pass(`Tech dept analytics: OK (${aakashAnalytics.body?.data?.employees?.length ?? 0} employees)`)
    : fail(`Tech analytics: ${aakashAnalytics.status} — ${aakashAnalytics.body?.error}`));

  // ── CHAIN 3: HR / COMPLIANCE / RESUME ──────────────────────────────
  console.log('\n━━━ HR / COMPLIANCE / RESUME CHAIN ━━━━━━━━━━━━━━\n');

  // 3a. BalKishan Tiwari (hr_head)
  console.log('▸ BalKishan Tiwari (HR001 - hr_head)');

  const hrEmps = await request('GET', '/api/employees', null, users.HR001.token);
  console.log(hrEmps.status === 200 ? pass(`HR Head sees all employees: ${hrEmps.body?.data?.length ?? 0}`) : fail(`Employees list: ${hrEmps.status}`));

  const hrNotice = await request('POST', '/api/hr/notices', {
    title: 'System Audit Notice', body: 'All employees please update their profiles.',
    notice_type: 'general', is_active: true
  }, users.HR001.token);
  console.log(hrNotice.status === 201 ? pass(`HR can create notice: 201`) : fail(`Create notice: ${hrNotice.status} — ${hrNotice.body?.error}`));

  const hrNoticeList = await request('GET', '/api/hr/notices', null, users.HR001.token);
  console.log(hrNoticeList.status === 200 ? pass(`HR notices visible: ${hrNoticeList.body?.data?.length ?? 0}`) : fail(`Notices list: ${hrNoticeList.status}`));

  const hrAttReport = await request('GET', '/api/attendance/report', null, users.HR001.token);
  console.log(hrAttReport.status === 200 ? pass(`HR attendance report: OK`) : fail(`Attendance report: ${hrAttReport.status} — ${hrAttReport.body?.error}`));

  const hrMgrLeaves = await request('GET', '/api/leaves/pending-manager', null, users.HR001.token);
  console.log(hrMgrLeaves.status === 200
    ? pass(`HR sees manager-pending leaves: count=${hrMgrLeaves.body?.data?.length}`)
    : fail(`HR pending-manager: ${hrMgrLeaves.status} — ${hrMgrLeaves.body?.error}`));

  // HR creates employee
  const newEmp = await request('POST', '/api/employees', {
    employee_code: 'TEST99', full_name: 'Audit Test User', email: 'audit.test@amoha.com',
    password: 'Amoha@2026', role: 'sales_executive', designation: 'Test',
    department_id: users.MKT001.emp?.department_id, team_id: users.MKT001.emp?.team_id
  }, users.HR001.token);
  console.log(newEmp.status === 201 ? pass(`HR can create employee: 201`) : fail(`Create employee: ${newEmp.status} — ${newEmp.body?.error}`));

  // 3b. Yogesh Jadoun (resume_head)
  console.log('\n▸ Yogesh Jadoun (RES001 - resume_head)');

  // Marketing creates a resume_building task for Resume dept
  const resumeTask = await request('POST', '/api/support-tasks', {
    task_type: 'resume_building',
    candidate_id: candidateId,
    notes: 'Build resume for interview preparation',
    scheduled_at: '2026-04-02T09:00:00Z'
  }, users.MKT001.token);
  console.log(resumeTask.status === 201 ? pass(`Marketing creates resume_building task: 201`) : fail(`Resume task: ${resumeTask.status} — ${resumeTask.body?.error}`));
  const resumeTaskId = resumeTask.body?.data?.id;

  const yogeshTasks = await request('GET', '/api/support-tasks', null, users.RES001.token);
  console.log(yogeshTasks.status === 200
    ? pass(`Yogesh (resume_head) sees support tasks: ${yogeshTasks.body?.data?.total ?? 0}`)
    : fail(`Yogesh tasks: ${yogeshTasks.status} — ${yogeshTasks.body?.error}`));

  const yogeshLeave = await request('GET', '/api/leaves/pending-tl', null, users.RES001.token);
  console.log(yogeshLeave.status === 200
    ? pass(`Yogesh pending team leaves: count=${yogeshLeave.body?.data?.length}`)
    : fail(`Yogesh pending-tl: ${yogeshLeave.status} — ${yogeshLeave.body?.error}`));

  // 3c. Gaurav Garg (compliance_officer)
  console.log('\n▸ Gaurav Garg (COM001 - compliance_officer)');

  const gauravPO = await request('GET', '/api/placement-orders', null, users.COM001.token);
  console.log(gauravPO.status === 200
    ? pass(`Compliance sees placement orders: ${gauravPO.body?.data?.length ?? 0}`)
    : fail(`Compliance PO access: ${gauravPO.status} — ${gauravPO.body?.error}`));

  const gauravCands = await request('GET', '/api/candidates', null, users.COM001.token);
  console.log(gauravCands.status === 200
    ? warn(`Compliance officer sees ALL candidates (${gauravCands.body?.data?.length ?? 0}) — may be by design or a scope issue`)
    : pass(`Candidates restricted for compliance: ${gauravCands.status}`));

  const gauravLeave = await request('POST', '/api/leaves',
    { leave_type: 'casual', from_date: '2026-04-10', to_date: '2026-04-10', reason: 'Personal' },
    users.COM001.token);
  console.log(gauravLeave.status === 201 ? pass(`Compliance submit leave: 201`) : fail(`Compliance leave: ${gauravLeave.status} — ${gauravLeave.body?.error}`));

  // ── CHAIN 4: OPS HEAD ──────────────────────────────────────────────
  console.log('\n━━━ OPERATIONS HEAD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('▸ Tripesh Koneru (OPS001 - ops_head)');

  const opsCands = await request('GET', '/api/candidates', null, users.OPS001.token);
  console.log(opsCands.status === 200 ? pass(`Ops sees all candidates: ${opsCands.body?.data?.length ?? 0}`) : fail(`Ops candidates: ${opsCands.status}`));

  const opsEmps = await request('GET', '/api/employees', null, users.OPS001.token);
  console.log(opsEmps.status === 200 ? pass(`Ops sees all employees: ${opsEmps.body?.data?.length ?? 0}`) : fail(`Ops employees: ${opsEmps.status}`));

  const opsLeaves = await request('GET', '/api/leaves/pending-manager', null, users.OPS001.token);
  console.log(opsLeaves.status === 200
    ? pass(`Ops pending-manager leaves: count=${opsLeaves.body?.data?.length}`)
    : fail(`Ops pending-manager: ${opsLeaves.status} — ${opsLeaves.body?.error}`));

  const opsAttReport = await request('GET', '/api/attendance/report', null, users.OPS001.token);
  console.log(opsAttReport.status === 200 ? pass(`Ops attendance report: OK`) : fail(`Ops att report: ${opsAttReport.status} — ${opsAttReport.body?.error}`));

  // Cross-dept analytics — ops should see everything
  for (const slug of ['sales','marketing','technical','resume','compliance']) {
    const r = await request('GET', `/api/analytics/departments/${slug}/summary`, null, users.OPS001.token);
    console.log(r.status === 200 ? pass(`Ops analytics for ${slug}: OK`) : fail(`Ops analytics ${slug}: ${r.status}`));
  }

  // ── CHAIN 5: DIRECTORS ─────────────────────────────────────────────
  console.log('\n━━━ DIRECTORS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('▸ Ashish Dabhi (DIR001 - director)');

  const dirPO = await request('GET', '/api/placement-orders', null, users.DIR001.token);
  console.log(dirPO.status === 200 ? pass(`Director sees all POs: ${dirPO.body?.data?.length ?? 0}`) : fail(`Director PO: ${dirPO.status}`));

  const dirAttReport = await request('GET', '/api/attendance/report', null, users.DIR001.token);
  console.log(dirAttReport.status === 200 ? pass(`Director attendance report: OK`) : fail(`Director att report: ${dirAttReport.status}`));

  const dirPoStats = await request('GET', '/api/placement-orders/stats', null, users.DIR001.token);
  console.log(dirPoStats.status === 200 ? pass(`Director PO stats: OK`) : fail(`Director PO stats: ${dirPoStats.status} — ${dirPoStats.body?.error}`));

  // Can director delete a PO?
  const poId = poList.body?.data?.[0]?.id || poCreate.body?.data?.id;
  if (poId) {
    const delPO = await request('DELETE', `/api/placement-orders/${poId}`, null, users.DIR001.token);
    console.log(delPO.status === 200 ? pass(`Director can delete PO: OK`) : warn(`Director delete PO: ${delPO.status} — ${delPO.body?.error}`));
  }

  // Non-director cannot delete PO
  const khushboo = await login('SAL003');
  const delPOUnauth = await request('DELETE', `/api/placement-orders/fake-id`, null, khushboo.token);
  console.log(delPOUnauth.status === 403 ? pass(`Sales exec blocked from deleting PO: 403 ✅`) : warn(`PO delete not properly guarded: got ${delPOUnauth.status}`));

  // ── CROSS-DEPARTMENT FLOW ──────────────────────────────────────────
  console.log('\n━━━ CROSS-DEPARTMENT FLOW TEST ━━━━━━━━━━━━━━━━━━\n');
  console.log('Scenario: Marketing creates task → Technical receives → marks done → Sales sees result');

  // Check if the task Prateek updated now shows completed status in analytics
  if (candidateId) {
    const finalHist = await request('GET', `/api/analytics/candidate/${candidateId}/history`, null, users.SAL003.token);
    const events = finalHist.body?.data?.history ?? [];
    console.log(finalHist.status === 200
      ? pass(`Sales exec sees candidate interview history: ${events.length} event(s)`)
      : fail(`Sales cannot see candidate history: ${finalHist.status}`));
    if (events.length > 0) {
      const completed = events.filter(e => e.call_status === 'completed');
      console.log(completed.length > 0
        ? pass(`Completed interview visible in history: ${completed.length} event(s)`)
        : warn(`No completed events yet in history`));
    }
  }

  // Notifications triggered?
  const notifs = await request('GET', '/api/notifications', null, users.TEC002.token);
  console.log(notifs.status === 200
    ? (notifs.body?.data?.unread_count > 0
        ? pass(`Prateek has ${notifs.body.data.unread_count} notification(s) from task assignment ✅`)
        : warn(`Prateek has 0 notifications — task assignment notification not firing`))
    : fail(`Notifications: ${notifs.status}`));

  console.log('\n══════════════════════════════════════════════════');
  console.log('  Audit Complete');
  console.log('══════════════════════════════════════════════════\n');
  process.exit(0);
}

main().catch(err => { console.error('Audit error:', err.message); process.exit(1); });
