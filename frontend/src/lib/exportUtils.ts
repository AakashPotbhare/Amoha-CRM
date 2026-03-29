import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ExportColumn {
  header: string;
  key: string;
}

// ─── Excel export ──────────────────────────────────────────────────────────

export function exportToExcel(
  rows: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string
) {
  const data = rows.map((row) =>
    Object.fromEntries(columns.map((col) => [col.header, row[col.key] ?? ""]))
  );
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ─── PDF export ────────────────────────────────────────────────────────────

export function exportToPDF(
  rows: Record<string, unknown>[],
  columns: ExportColumn[],
  title: string,
  filename: string
) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 15);

  autoTable(doc, {
    startY: 22,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((col) => String(row[col.key] ?? ""))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  doc.save(`${filename}.pdf`);
}

// ─── Attendance helpers ────────────────────────────────────────────────────

export const attendanceColumns: ExportColumn[] = [
  { header: "Employee", key: "employee_name" },
  { header: "Date", key: "date" },
  { header: "Check In", key: "check_in" },
  { header: "Check Out", key: "check_out" },
  { header: "Total Hours", key: "total_hours" },
  { header: "Status", key: "status" },
  { header: "Notes", key: "notes" },
];

export function formatAttendanceForExport(records: Record<string, unknown>[]) {
  return records.map((r) => ({
    ...r,
    check_in: r.check_in ? String(r.check_in).slice(0, 5) : "-",
    check_out: r.check_out ? String(r.check_out).slice(0, 5) : "-",
    total_hours: r.total_hours != null ? `${r.total_hours}h` : "-",
  }));
}

// ─── Payroll helpers ───────────────────────────────────────────────────────

export const payrollColumns: ExportColumn[] = [
  { header: "Employee", key: "employee_name" },
  { header: "Department", key: "department" },
  { header: "Role", key: "role" },
  { header: "Days Present", key: "days_present" },
  { header: "Days Absent", key: "days_absent" },
  { header: "Base Salary", key: "base_salary" },
  { header: "Deductions", key: "deductions" },
  { header: "Net Pay", key: "net_pay" },
];

export function formatPayrollForExport(records: Record<string, unknown>[]) {
  return records.map((r) => ({
    ...r,
    base_salary: r.base_salary != null ? `₹${Number(r.base_salary).toLocaleString()}` : "-",
    deductions: r.deductions != null ? `₹${Number(r.deductions).toLocaleString()}` : "₹0",
    net_pay: r.net_pay != null ? `₹${Number(r.net_pay).toLocaleString()}` : "-",
  }));
}
