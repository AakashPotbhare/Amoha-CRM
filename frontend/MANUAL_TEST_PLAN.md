# RecruitHUB — Manual Testing Plan (End-to-End, Role-Based)

> **Project:** RecruitHUB by Amoha Recruitment Services  
> **Tech Stack:** React + Vite + TypeScript + Supabase + Tailwind + shadcn/ui  
> **Date:** 11 March 2026  

---

## 📋 Table of Contents
1. [Roles & Access Summary](#1-roles--access-summary)
2. [Test Accounts](#2-test-accounts)
3. [Module-wise Test Cases](#3-module-wise-test-cases)
4. [Role-Based Test Matrix](#4-role-based-test-matrix)
5. [UX & Improvement Observations](#5-ux--improvement-observations)
6. [Cross-Department Data Accuracy Checks](#6-cross-department-data-accuracy-checks)

---

## 1. Roles & Access Summary

| Role | Sidebar Access | Dashboard | Dept Pages | HR Page | Attendance Report | Shift Settings | Candidates/Enroll |
|------|---------------|-----------|------------|---------|------------------|----------------|-------------------|
| **Director** (DIR001-003) | All nav items | Overview + All Depts | All 5 depts | ✅ | ✅ | ✅ | ✅ |
| **Ops Head** (OPS001) | All nav items | Overview + All Depts | All 5 depts | ✅ | ✅ | ✅ | ✅ |
| **HR Head** (HR001) | Standard + HR | Own dept only | Own dept | ✅ | ❌ (code check needed) | ❌ | ❌ |
| **Sales Manager** (SAL001) | Standard + Enroll/Candidates | Own dept | Sales only | ❌ | ❌ | ❌ | ✅ |
| **Dept Head** (RES001) | Standard | Own dept | Resume only | ❌ | ❌ | ❌ | ❌ |
| **Team Lead** (MKT001-004) | Standard | Own dept | Marketing only | ❌ | ❌ | ❌ | ❌ |
| **Recruiter / Senior Recruiter** | Standard | Own dept | Own dept | ❌ | ❌ | ❌ | ❌ |
| **Resume Builder** | Standard | Own dept | Resume only | ❌ | ❌ | ❌ | ❌ |

**Key access rules:**
- `canViewAllDepartments` → only `director` and `ops_head`
- Sidebar hides pages based on role/department
- Leave approvers: `team_lead`, `ops_head`, `director`
- HR Management: `hr_head`, `director`, `ops_head`

---

## 2. Test Accounts

From the seed data (`setup-database.sql`), the following employees exist. You need to create Supabase auth users for them and link `user_id`.

| Employee Code | Name | Role | Department | Email |
|--------------|------|------|------------|-------|
| DIR001 | Aashish Dabhi | Director | Technical | aashish@amoha.in |
| DIR002 | Karan Sharma | Director | Technical | karan@amoha.in |
| DIR003 | Manthan Sharma | Director | Technical | manthan@amoha.in |
| OPS001 | Tripesh Koneru | Ops Head | Compliance | tripesh@amoha.in |
| HR001 | Balkishan Tiwari | HR Head | Compliance | balkishan@amoha.in |
| SAL001 | Vishesh Shah | Sales Manager | Sales | vishesh@amoha.in |
| RES001 | Yogesh Lokam | Dept Head | Resume | yogesh@amoha.in |
| MKT001 | Aditya Singh Tomar | Team Lead | Marketing (Team Aditya) | aditya@amoha.in |
| MKT002 | Bhavitya Naithani | Team Lead | Marketing (Team Bhavitya) | bhavitya@amoha.in |
| MKT003 | Yash Mistri | Team Lead | Marketing (Team Yash) | yash@amoha.in |
| MKT004 | Aman Pandey | Team Lead | Marketing (Team Aman) | aman@amoha.in |

> ⚠️ No `recruiter` or `resume_builder` role employees are seeded. You'll need to add at least one of each via the HR Dashboard or directly in Supabase to test those roles.

---

## 3. Module-wise Test Cases

### 3.1 🔐 Authentication (Login Page)

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| A1 | Login with valid employee code | Enter `DIR001` + correct password → Sign In | Redirects to Home (`/`) | 🔴 High |
| A2 | Login with invalid employee code | Enter `XXXXX` + any password | Error toast: "Invalid employee code" | 🔴 High |
| A3 | Login with wrong password | Enter valid code + wrong password | Error toast: "Invalid credentials" | 🔴 High |
| A4 | Login with lowercase code | Enter `dir001` | Should auto-uppercase & work | 🟡 Medium |
| A5 | Forgot password flow | Click "Forgot password?" → enter email → submit | Toast: "Check your Gmail" (Supabase sends reset email) | 🟡 Medium |
| A6 | Already logged in → visit /login | Navigate to /login while authenticated | Should redirect to `/` | 🟡 Medium |
| A7 | Access protected route without login | Clear cookies → visit `/dashboard` | Should redirect to `/login` | 🔴 High |
| A8 | Inactive employee login | Set employee `is_active = false` in DB → try login | Should fail (code returns no email via RPC) | 🔴 High |

### 3.2 🏠 Home Page

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| H1 | Welcome message shows name | Login as any user | "Welcome back, {firstName}!" with dept & role | 🟡 Medium |
| H2 | Action cards for Director/Ops Head | Login as DIR001 | Should see: Get Tasks, Create Task, My Dashboard, My Profile, Enroll Candidate | 🔴 High |
| H3 | Action cards for Sales Manager | Login as SAL001 | Should see Enroll Candidate card | 🔴 High |
| H4 | Action cards for Team Lead (non-sales) | Login as MKT001 | Should NOT see Enroll Candidate | 🔴 High |
| H5 | "My Dashboard" card routing | Click "My Dashboard" as Director | Goes to `/dashboard` (overview) | 🟡 Medium |
| H6 | "My Dashboard" card routing (dept user) | Click "My Dashboard" as MKT001 | Goes to `/departments/marketing` | 🟡 Medium |
| H7 | Notice Board renders | Check bottom of Home page | Should show notice board with active notices | 🟢 Low |

### 3.3 📊 Overview Dashboard (`/dashboard` — Director/Ops Head only)

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| D1 | KPI cards display | Login as Director → go to Dashboard | 4 KPI cards with recruitment pipeline data | 🔴 High |
| D2 | Candidate pipeline stages | Check pipeline section | Shows count per stage: New, Screening, Interview, Offer, Placed | 🔴 High |
| D3 | Department performance bars | Check right panel | All 5 departments with performance % bars | 🟡 Medium |
| D4 | Recent candidates table | Scroll to bottom | Last 6 candidates with name, position, status, assigned to, updated | 🟡 Medium |
| D5 | Non-leadership accessing /dashboard | Login as recruiter → manually navigate to `/dashboard` | ⚠️ **CHECK**: Does it show mock data or restrict? (Currently uses mockData, no role guard on the route!) | 🔴 High |

### 3.4 📂 Department Dashboards

#### 3.4.1 Marketing Department (`/departments/marketing`)

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| MK1 | Page loads for Marketing TL | Login as MKT001 → sidebar → Marketing | Shows support tasks grouped by team | 🔴 High |
| MK2 | Team stats display | Check summary cards | Total tasks, Interviews, Completed, Pending per team | 🟡 Medium |
| MK3 | Tabs: Calendar / Task list / Team Performance | Switch between tabs | Each tab renders correctly | 🟡 Medium |
| MK4 | Status labels and round labels | Check task cards | Proper labels for interview_support, assessment_support, ruc, mock_call, preparation_call | 🟢 Low |
| MK5 | Director sees all teams | Login as DIR001 → Marketing dept | All 4 teams visible: Aditya, Bhavitya, Yash, Aman | 🔴 High |

#### 3.4.2 Sales Department (`/departments/sales`)

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| SL1 | Candidate list loads | Login as SAL001 → Sales dept | All candidates listed with details | 🔴 High |
| SL2 | Expandable candidate rows | Click a candidate row | Shows detailed info | 🟡 Medium |
| SL3 | Team Performance tab | Switch to Team Performance tab | Shows team stats | 🟡 Medium |
| SL4 | Enroll Candidate shortcut | Click "Enroll Candidate" in sidebar | Navigates to `/candidates/enroll` | 🟡 Medium |

#### 3.4.3 Technical Department (`/departments/technical`)

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| TC1 | Support tasks load | Login as Technical TL → Technical dept | Shows support tasks (interview support, mock calls, etc.) | 🔴 High |
| TC2 | Pickup/assign task | Click to pick up a task | Task assigned to current user | 🟡 Medium |
| TC3 | Task status update | Change status on a task | Status updates in real-time | 🟡 Medium |
| TC4 | Call status / Teams link / Feedback | Fill call_status, teams_link, feedback fields | Data saves correctly | 🟡 Medium |
| TC5 | "My Queue" page | Navigate to `/my-queue` from sidebar | Shows only tasks assigned to current technical employee | 🔴 High |

#### 3.4.4 Resume Department (`/departments/resume`)

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| RS1 | Resume tasks load | Login as RES001 → Resume dept | Shows resume-related tasks with status, priority | 🔴 High |
| RS2 | Status filter | Filter by pending/in_progress/completed | List updates correctly | 🟡 Medium |
| RS3 | Task details expand | Click to expand a task | Shows notes, comments, deadline | 🟡 Medium |
| RS4 | Comments system | Add a comment on a task | Comment saved & shown with employee name | 🟡 Medium |

#### 3.4.5 Compliance Department (`/departments/compliance`)

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| CM1 | Tasks load | Login as OPS001 → Compliance | Shows compliance tasks | 🔴 High |
| CM2 | Status & priority display | Check task cards | Correct color coding for status/priority | 🟢 Low |
| CM3 | Team Performance tab | Switch to Team Performance | Shows stats | 🟡 Medium |

### 3.5 ✅ Task Management

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| T1 | View tasks inbox | Go to `/tasks/inbox` | Shows tasks assigned to me/my dept/team | 🔴 High |
| T2 | Create a new task | Go to `/tasks/create` → fill title, description, priority, assign to dept/employee/team → submit | Task created, appears in assignee's inbox | 🔴 High |
| T3 | Create support task | Go to `/tasks/create/support` | Support-specific task form works | 🟡 Medium |
| T4 | Task status update | Change task status from open → in_progress → completed | Status persists in DB | 🔴 High |
| T5 | Task comments | Add comment on a task | Comment saved with employee info | 🟡 Medium |
| T6 | Cross-department task assignment | Sales creates task for Technical | Task appears in Technical's inbox | 🔴 High |

### 3.6 👤 Candidate Management

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| C1 | Enroll new candidate | Go to `/candidates/enroll` → fill form → submit | Candidate created in DB | 🔴 High |
| C2 | View candidates list | Go to `/candidates` | All candidates listed | 🔴 High |
| C3 | Enrollment tracking | Create enrollment for candidate with job_title, company, status | Enrollment saved | 🟡 Medium |
| C4 | Only Sales/Director/Ops Head access | Login as Marketing TL → manually visit `/candidates/enroll` | ⚠️ **CHECK**: Is the route protected or just sidebar hidden? | 🔴 High |

### 3.7 ⏰ Attendance Module

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| AT1 | Check-in with geofence | Login → Attendance → Check In (within office radius) | Attendance record created, location stored | 🔴 High |
| AT2 | Check-in outside geofence | Spoof location outside radius | Should show WFH option or reject | 🔴 High |
| AT3 | Check-out | After check-in → click Check Out | check_out_time saved, total_hours calculated | 🔴 High |
| AT4 | Late detection | Check-in after shift start + grace period | `is_late = true`, badge shown | 🟡 Medium |
| AT5 | WFH marking | Mark attendance as WFH | `is_wfh = true` | 🟡 Medium |
| AT6 | Break management | Take Break 1 (short), Break 2 (lunch), Break 3 (short) | Breaks saved in `attendance_breaks` with correct types | 🟡 Medium |
| AT7 | Break duration validation | Break exceeds expected time (15/45 mins) | ⚠️ **CHECK**: Is there any warning or it just records? | 🟡 Medium |
| AT8 | Calendar view | Check month calendar | Days color-coded: present (green), late (red), wfh (blue), absent (red), weekend (gray) | 🟡 Medium |
| AT9 | Day details panel | Click a specific date | Shows check-in/out times, breaks, hours | 🟢 Low |
| AT10 | Month/year selector | Change month/year | Calendar updates with historical data | 🟢 Low |
| AT11 | Admin attendance report | Login as Director → Attendance Report | Shows all employees' attendance stats | 🔴 High |
| AT12 | Double check-in same day | Check in → try checking in again | Should prevent duplicate (unique constraint) | 🔴 High |

### 3.8 🏖️ Leave Management

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| L1 | View leave balance | Go to `/leaves` | Shows paid_leave_credited, used, unpaid used | 🔴 High |
| L2 | Apply for leave (paid) | Select type, start/end date, reason → submit | Leave request created with status "pending" | 🔴 High |
| L3 | Apply for leave (unpaid) | Same with unpaid type | Works correctly | 🟡 Medium |
| L4 | Total days auto-calculation | Select start & end date | Days calculated automatically | 🟡 Medium |
| L5 | Approver sees pending requests | Login as Team Lead | "Pending Approvals" tab shows team member requests | 🔴 High |
| L6 | Approve leave | Approver clicks approve | Status updates to approved, leave balance deducted | 🔴 High |
| L7 | Reject leave | Approver clicks reject + adds reason | Status updates to rejected | 🔴 High |
| L8 | Non-approver can't approve | Login as recruiter | Should NOT see approval tab/actions | 🔴 High |
| L9 | My requests history | Check "My Requests" tab | Shows all past leave requests with status | 🟡 Medium |
| L10 | Paid leave insufficient balance | Apply for more days than balance | ⚠️ **CHECK**: Is there a validation? | 🔴 High |

### 3.9 ⚙️ Shift Management (Admin only)

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| SM1 | View shift settings | Login as Director → Shift Settings | Shows current shift: 09:30-18:30, 15 min grace, 8 hrs required | 🟡 Medium |
| SM2 | Edit shift timing | Modify start/end time | Saves to DB, affects late calculation | 🟡 Medium |
| SM3 | Non-admin access | Login as Team Lead → manually visit `/shift-management` | ⚠️ **CHECK**: Is the page guarded? | 🔴 High |

### 3.10 👥 HR Management (`/hr`)

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| HR1 | Employee directory | Login as HR001 → HR page | Shows all employees with search | 🔴 High |
| HR2 | Add new employee | Click add employee → fill form → submit | Employee created in DB (+ Supabase auth user?) | 🔴 High |
| HR3 | Edit employee details | Click edit on existing employee | Can update dept, team, role, salary, etc. | 🔴 High |
| HR4 | Salary management | Edit salary fields (base_salary, PF %, professional tax) | Saves correctly, salary history recorded | 🟡 Medium |
| HR5 | Salary history tracking | View salary change history for an employee | Shows previous/new salary, changed by, date | 🟡 Medium |
| HR6 | Employment status management | Change employee employment_status (active, probation, notice, etc.) | Updates correctly | 🟡 Medium |
| HR7 | Department/team transfer | Change employee's department/team | Transfer recorded | 🟡 Medium |
| HR8 | Notice board management | Add/edit/remove notices | Notices appear on Home page | 🟡 Medium |
| HR9 | Attendance stats in HR | Check attendance summary by employee | Present, half-day, late, WFH counts | 🟡 Medium |
| HR10 | Non-HR access | Login as Sales Manager → visit `/hr` | ⚠️ **CHECK**: Route-level protection? | 🔴 High |

### 3.11 👤 Profile Page

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| P1 | View own profile | Go to `/profile` | Shows employee details: name, code, dept, team, role, etc. | 🟡 Medium |
| P2 | Edit own details | Update phone, avatar, etc. | Saves via `employees_update_own` RLS policy | 🟡 Medium |
| P3 | Cannot edit other's profile | Try to update another employee's record | RLS should block | 🔴 High |

### 3.12 💬 Chat Widget

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| CH1 | Chat widget renders | Check for ChatWidget component | Should be accessible | 🟢 Low |
| CH2 | Send message | Type & send | Saved to chat_messages | 🟢 Low |

### 3.13 🔔 Notifications

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| N1 | Bell icon shows count | Check header | Unread notifications count | 🟡 Medium |
| N2 | Mark as read | Click notification | `is_read` updates | 🟢 Low |
| N3 | RLS check | User A can't see User B's notifications | Only own notifications visible | 🔴 High |

---

## 4. Role-Based Test Matrix

Test each of these flows as every major role:

| Test Flow | Director | Ops Head | HR Head | Sales Mgr | Dept Head | Team Lead | Recruiter |
|-----------|----------|----------|---------|-----------|-----------|-----------|-----------|
| Login & Home | ✅ Test | ✅ Test | ✅ Test | ✅ Test | ✅ Test | ✅ Test | ✅ Test |
| Sidebar items correct | ✅ Test | ✅ Test | ✅ Test | ✅ Test | ✅ Test | ✅ Test | ✅ Test |
| Can see Overview dashboard | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| Can see own dept dashboard | ✅ All | ✅ All | ✅ Own | ✅ Own | ✅ Own | ✅ Own | ✅ Own |
| Can see OTHER dept dashboard | ✅ All | ✅ All | ❌ | ❌ | ❌ | ❌ | ❌ |
| HR Management page | ✅ Yes | ✅ Yes | ✅ Yes | ❌ | ❌ | ❌ | ❌ |
| Attendance Report | ✅ Yes | ✅ Yes | ❌ | ❌ | ❌ | ❌ | ❌ |
| Shift Settings | ✅ Yes | ✅ Yes | ❌ | ❌ | ❌ | ❌ | ❌ |
| Candidate Enroll | ✅ Yes | ✅ Yes | ❌ | ✅ Yes | ❌ | ❌ | ❌ |
| Candidates list | ✅ Yes | ✅ Yes | ❌ | ✅ Yes | ❌ | ❌ | ❌ |
| My Queue (tech support) | ✅ Yes | ✅ Yes | ❌ | ❌ | ❌ | ❌ | ❌ |
| Leave approval | ✅ Yes | ✅ Yes | ❌ | ❌ | ❌ | ✅ Yes | ❌ |
| Create/view tasks | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Own attendance | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Own leaves | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

---

## 5. UX & Improvement Observations

### 🔴 Critical Issues (Must Fix)

1. **No route-level guards on department pages** — Sidebar hides links, but if a user manually types `/departments/sales` or `/hr` or `/dashboard`, the page might still render. Need:
   - Route-level access checks in each page component (redirect to Home if unauthorized)
   - OR a wrapper component that checks `useEmployeeAccess()` before rendering

2. **Overview Dashboard uses mockData** — `Dashboard.tsx` imports from `@/data/mockData.ts` (hardcoded). Real data from Supabase is NOT used here. This defeats the purpose for Director/Ops Head. Should query live candidate pipeline, department stats from Supabase.

3. **No recruiter/resume_builder test accounts seeded** — Can't test the most common role (floor-level employee) without manually creating accounts.

4. **Leave balance validation missing (likely)** — Need to verify if applying for more paid leave than available balance is blocked client-side or server-side.

5. **No RLS policies for leadership reads** — All `SELECT` policies are `USING (true)` for authenticated users, meaning any employee can read ALL attendance records, tasks, candidates, etc. This is fine for transparent orgs but may need role-based READ restrictions later (e.g., salary data).

### 🟡 UX Improvements

6. **Salary data visible to all** — `employees` table includes `base_salary`, `pf_percentage`, `professional_tax` and the SELECT policy is open. Any logged-in user can query other employees' salary via Supabase client.

7. **No loading/empty states on some pages** — Some department dashboards may show blank if no data exists. Need "No tasks yet" or skeleton states.

8. **Dashboard should be role-adaptive** — Instead of showing mock data, pull real KPIs based on the logged-in user's role:
   - Director/Ops Head → company-wide stats
   - Team Lead → team-specific stats
   - Recruiter → personal KPIs

9. **Task creation UX** — Two separate routes for regular tasks (`/tasks/create`) and support tasks (`/tasks/create/support`). Consider merging into one form with a task type selector.

10. **No pagination on lists** — Candidates, tasks, and attendance records load everything. As data grows, this will become slow. Add pagination or infinite scroll.

11. **No search/filter on several pages** — Candidate enrollment, task inbox could benefit from search bars and more filter options.

12. **Calendar attendance view** — Nice! But would benefit from:
    - Week view option
    - Export to CSV/PDF
    - Team calendar view for managers

13. **Break tracking UX** — Current break policy (Short → Long → Short) is hardcoded. Should be configurable per shift in `shift_settings`.

14. **Notice Board** — No expiry enforcement on client side. Expired notices (`expires_at` in past) should be hidden automatically.

15. **Profile page** — Limited edit capabilities. Consider letting employees update their address, emergency contact, documents.

16. **Dark mode support** — Theme toggle component exists (`ThemeToggle.tsx`) but verify it works across all pages consistently.

### 🟢 Nice-to-Have

17. **Audit logging** — Track who changed what and when (employee status changes, salary updates, etc.)

18. **Email notifications** — Leave approvals, task assignments should trigger email notifications.

19. **Mobile responsiveness** — Sidebar collapses but verify all pages work well on mobile.

20. **Reporting & analytics** — Monthly attendance reports, department-wise performance trends, leave utilization charts.

21. **Employee documents** — Table exists (`employee_documents`) but no UI to upload/view documents.

22. **Salary slip generation** — No payroll module in RecruitHUB (unlike Amoha HRMS). Consider adding basic salary slip generation.

---

## 6. Cross-Department Data Accuracy Checks

These verify that data flows correctly across the system:

| # | Check | How to Verify |
|---|-------|--------------|
| X1 | Candidate enrolled by Sales → visible to Director | Enroll as SAL001, login as DIR001 → check candidates list |
| X2 | Support task created by Marketing → appears in Technical queue | Create as MKT001, check as Technical TL |
| X3 | Resume task created for Resume dept → shows in Resume Dashboard | Create task assigned to Resume dept, verify in Resume dashboard |
| X4 | Leave applied by employee → visible to Team Lead for approval | Apply as recruiter, login as TL → check pending approvals |
| X5 | Attendance check-in → reflected in Admin Report | Check-in as any employee, login as Director → check Attendance Report |
| X6 | Salary updated by HR → appears in salary history | Update salary in HR dashboard, verify history tab |
| X7 | Notice posted by HR → shows on everyone's Home page | Post notice as HR, login as different roles → check Home |
| X8 | Task comments visible to both parties | Creator adds comment, assignee sees it and vice versa |
| X9 | Employee transfer → dept dashboard updates | Transfer employee from Sales to Marketing, verify both dashboards |
| X10 | Notification delivered correctly | Trigger notification → check target user's bell icon & list |

---

## 📝 Testing Methodology

### Suggested Order:
1. **Authentication** → ensure all accounts can log in
2. **Home page** → verify per-role rendering
3. **Sidebar navigation** → confirm visibility rules
4. **Attendance** → test check-in/out/break/calendar (daily use feature)
5. **Leave management** → apply + approve flow
6. **Task management** → create + inbox + cross-dept
7. **Department dashboards** → one by one, each role
8. **HR management** → employee CRUD, salary, notices
9. **Candidate management** → enroll + list
10. **Profile & notifications** → verify personal data access
11. **Cross-department flows** → end-to-end scenarios
12. **Security** → manual URL access, RLS bypass attempts

### For Each Role:
1. Login with that role
2. Screenshot the sidebar (document what's visible)
3. Click through every available nav item
4. Try creating/editing data where applicable
5. Try manually accessing URLs they shouldn't see
6. Log findings in a spreadsheet or checklist

---

*Document generated by Spark ⚡ for Aakash's RecruitHUB testing.*
