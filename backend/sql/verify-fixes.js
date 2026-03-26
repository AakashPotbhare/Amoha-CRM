/**
 * Verify bug fixes for leave management and auth/me
 */
const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 4000,
      path, method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getToken(code) {
  const r = await request('POST', '/api/auth/login', { employeeCode: code, password: 'Amoha@2026' });
  return r.body?.data?.token;
}

async function main() {
  console.log('\n=== Bug Fix Verification ===\n');

  const khushbooToken = await getToken('SAL003');
  const visheshToken  = await getToken('SAL001');
  const parthToken    = await getToken('SAL002');
  const tripeshToken  = await getToken('OPS001');

  // Fix 1: Leave type 'paid' now accepted
  const leaveR = await request('POST', '/api/leaves',
    { leave_type: 'paid', from_date: '2026-04-05', to_date: '2026-04-05', reason: 'Personal' },
    khushbooToken
  );
  console.log(`[Fix 1] Leave submit with 'paid' type: ${leaveR.status === 201 ? '✅ FIXED' : '❌ STILL BROKEN'} (status ${leaveR.status}) ${leaveR.body?.error || ''}`);

  // Fix 2: /auth/me no longer exposes password_hash
  const meR = await request('GET', '/api/auth/me', null, khushbooToken);
  console.log(`[Fix 2] /auth/me hides password_hash: ${!meR.body?.data?.password_hash ? '✅ FIXED' : '❌ STILL EXPOSED'}`);

  // Fix 3: Sales Head can view pending-tl without crashing
  const visheshPending = await request('GET', '/api/leaves/pending-tl', null, visheshToken);
  console.log(`[Fix 3] Vishesh (sales_head) pending-tl: ${visheshPending.status === 200 ? '✅ FIXED (count=' + visheshPending.body?.data?.length + ')' : '❌ STILL BROKEN ('+visheshPending.status+') '+visheshPending.body?.error}`);

  // Fix 4: Parth (assistant_tl) can now approve leaves
  const parthPending = await request('GET', '/api/leaves/pending-tl', null, parthToken);
  console.log(`[Fix 4] Parth (assistant_tl) pending-tl: ${parthPending.status === 200 ? '✅ FIXED (count=' + parthPending.body?.data?.length + ')' : '❌ STILL BROKEN ('+parthPending.status+') '+parthPending.body?.error}`);

  // Fix 5: Approve TL leaves without crashing
  if (visheshPending.status === 200 && visheshPending.body?.data?.length > 0) {
    const leaveId = visheshPending.body.data[0].id;
    const approveR = await request('PATCH', `/api/leaves/${leaveId}/approve-tl`, {}, visheshToken);
    console.log(`[Fix 5] TL approval (approved_by_tl column): ${approveR.status === 200 ? '✅ FIXED' : '❌ STILL BROKEN ('+approveR.status+') '+approveR.body?.error}`);

    // Fix 6: Manager sees tl_approved leaves
    const mgr = await request('GET', '/api/leaves/pending-manager', null, tripeshToken);
    console.log(`[Fix 6] Ops Head sees tl_approved leaves: ${mgr.status === 200 ? '✅ WORKS (count='+mgr.body?.data?.length+')' : '❌ BROKEN ('+mgr.status+')'}`);
  } else {
    console.log('[Fix 5] Skipped — no pending leaves to approve');
    console.log('[Fix 6] Skipped — no tl_approved leaves yet');
  }

  console.log('\nDone.\n');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
