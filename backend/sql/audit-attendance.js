/**
 * Attendance check-in / check-out / break audit
 */
const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 4000, path, method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch(e) { resolve({ status: res.statusCode, body: {} }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login(code) {
  const r = await request('POST', '/api/auth/login', { employeeCode: code, password: 'Amoha@2026' });
  if (!r.body?.data?.token) throw new Error(`Login failed for ${code}`);
  return r.body.data.token;
}

function pass(m) { console.log(`  ✅ ${m}`); }
function fail(m) { console.log(`  ❌ ${m}`); }
function info(m) { console.log(`  ℹ️  ${m}`); }

async function testUser(code, name, token) {
  console.log(`\n▸ ${name} (${code})`);

  // 1. Check today's status before anything
  const today = await request('GET', '/api/attendance/today', null, token);
  if (today.status === 200) {
    const d = today.body?.data;
    info(`Current state: checked_in=${d?.checked_in}, on_break=${d?.on_break}, check_in_time=${d?.check_in_time || 'null'}`);
  } else {
    fail(`GET /attendance/today: ${today.status} — ${today.body?.error}`);
    return;
  }

  // 2. Check-in (with dummy coords — no geofence configured)
  const ci = await request('POST', '/api/attendance/check-in', {
    latitude: 22.9964, longitude: 72.4990,  // Amoha approximate coords
    device_info: 'Audit Test'
  }, token);
  if (ci.status === 200 || ci.status === 201) {
    pass(`Check-in: ${ci.status} — check_in_time=${ci.body?.data?.check_in_time}`);
  } else {
    fail(`Check-in: ${ci.status} — ${ci.body?.error}`);
  }

  // 3. Start break
  const bs = await request('POST', '/api/attendance/break/start', {}, token);
  if (bs.status === 200 || bs.status === 201) {
    pass(`Break start: ${bs.status}`);
  } else {
    fail(`Break start: ${bs.status} — ${bs.body?.error}`);
  }

  // 4. End break
  const be = await request('POST', '/api/attendance/break/end', {}, token);
  if (be.status === 200 || be.status === 201) {
    pass(`Break end: ${be.status}`);
  } else {
    fail(`Break end: ${be.status} — ${be.body?.error}`);
  }

  // 5. Double break start (should fail gracefully)
  const bs2 = await request('POST', '/api/attendance/break/start', {}, token);
  if (bs2.status === 400) {
    pass(`Double break start correctly rejected: 400 — ${bs2.body?.error}`);
  } else if (bs2.status === 200 || bs2.status === 201) {
    // Start it so we can end it
    await request('POST', '/api/attendance/break/end', {}, token);
    fail(`Double break start not rejected (should be 400)`);
  }

  // 6. Check-out
  const co = await request('POST', '/api/attendance/check-out', {
    latitude: 22.9964, longitude: 72.4990
  }, token);
  if (co.status === 200 || co.status === 201) {
    pass(`Check-out: ${co.status} — total_hours=${co.body?.data?.total_hours || co.body?.data?.worked_hours}`);
  } else {
    fail(`Check-out: ${co.status} — ${co.body?.error}`);
  }

  // 7. Double check-out (should fail)
  const co2 = await request('POST', '/api/attendance/check-out', {
    latitude: 22.9964, longitude: 72.4990
  }, token);
  if (co2.status === 400) {
    pass(`Double check-out correctly rejected: 400`);
  } else {
    fail(`Double check-out not rejected: ${co2.status} — ${co2.body?.error}`);
  }

  // 8. Undo checkout
  const undo = await request('POST', '/api/attendance/undo-checkout', {}, token);
  if (undo.status === 200 || undo.status === 201) {
    pass(`Undo checkout: ${undo.status}`);
    // Re-checkout cleanly
    await request('POST', '/api/attendance/check-out', { latitude: 22.9964, longitude: 72.4990 }, token);
  } else {
    fail(`Undo checkout: ${undo.status} — ${undo.body?.error}`);
  }

  // 9. Today's summary after full flow
  const todayFinal = await request('GET', '/api/attendance/today', null, token);
  if (todayFinal.status === 200) {
    const d = todayFinal.body?.data;
    info(`Final state: checked_in=${d?.checked_in}, status=${d?.attendance_status}, hours=${d?.total_hours || d?.worked_hours}`);
  }

  // 10. Monthly view
  const monthly = await request('GET', '/api/attendance/monthly', null, token);
  if (monthly.status === 200) {
    pass(`Monthly attendance: ${monthly.body?.data?.length ?? 0} records`);
  } else {
    fail(`Monthly attendance: ${monthly.status} — ${monthly.body?.error}`);
  }
}

async function main() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  Attendance (Check-in / Check-out / Break) Audit');
  console.log('══════════════════════════════════════════════════');

  const tokens = {
    SAL003: await login('SAL003'),  // regular staff (Khushboo)
    TEC002: await login('TEC002'),  // technical exec (Prateek)
    MKT001: await login('MKT001'),  // marketing TL (Aditya)
    OPS001: await login('OPS001'),  // ops head (Tripesh)
  };

  await testUser('SAL003', 'Khushboo Chaudhary', tokens.SAL003);
  await testUser('TEC002', 'Prateek Makwana',    tokens.TEC002);
  await testUser('MKT001', 'Aditya Singh',       tokens.MKT001);
  await testUser('OPS001', 'Tripesh Koneru',     tokens.OPS001);

  // Leadership-only: attendance report
  console.log('\n━━━ Leadership: Attendance Report ━━━━━━━━━━━━━━━\n');
  const opsReport = await request('GET', '/api/attendance/report?period=today', null, tokens.OPS001);
  if (opsReport.status === 200) {
    console.log(`  ✅ Ops Head sees attendance report: ${opsReport.body?.data?.length ?? 0} records`);
  } else {
    console.log(`  ❌ Ops report: ${opsReport.status} — ${opsReport.body?.error}`);
  }

  // Regular staff blocked from report
  const khushbooReport = await request('GET', '/api/attendance/report', null, tokens.SAL003);
  if (khushbooReport.status === 403) {
    console.log(`  ✅ Regular staff blocked from report: 403`);
  } else {
    console.log(`  ❌ Regular staff should be blocked from report, got: ${khushbooReport.status}`);
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log('  Attendance Audit Complete');
  console.log('══════════════════════════════════════════════════\n');
  process.exit(0);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
