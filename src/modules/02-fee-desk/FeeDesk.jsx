import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Filter,
  IndianRupee,
  Printer,
  Receipt,
  Search,
  Send,
  Wallet,
  X,
} from 'lucide-react';
import { formatINR } from '../../core/currencyMath';
import { can } from '../../core/permissions';
import { postBulkRemind, postPayment, postWaiveFine } from '../../core/api';
import { recordAudit } from '../../core/auditLogger';

const CLASS_OPTIONS = ['ALL', '8', '9', '10', '12'];

const STATUS_OPTIONS = [
  { id: 'ALL', label: 'All students' },
  { id: 'OVERDUE', label: 'Overdue' },
  { id: 'CLEARED', label: 'Cleared' },
  { id: 'CREDIT', label: 'Credit balance' },
];

const EMPTY_DRAFT = { pay: '', discount: '', waive: false };

function duesFor(student) {
  const tuitionAfterScholarship = student.tuition * (1 - student.scholarshipPct / 100);
  const pending = tuitionAfterScholarship + student.lateFine - student.paidAmount;
  const collectedPct = tuitionAfterScholarship > 0 ? Math.round((student.paidAmount / tuitionAfterScholarship) * 100) : 100;
  return { tuitionAfterScholarship, pending, collectedPct };
}

export default function FeeDesk({ students, school, role, onAudit, onToast }) {
  const [rows, setRows] = useState(students);
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selected, setSelected] = useState(new Set());
  const [drafts, setDrafts] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({ cash: '', upi: '', discount: '', waiveFine: false, note: '' });

  useEffect(() => {
    setRows(students);
  }, [students]);

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return rows.filter((student) => {
      if (classFilter !== 'ALL' && student.className !== classFilter) return false;

      const { pending } = duesFor(student);
      if (statusFilter === 'OVERDUE' && pending <= 0) return false;
      if (statusFilter === 'CLEARED' && pending !== 0) return false;
      if (statusFilter === 'CREDIT' && pending >= 0) return false;

      if (!needle) return true;
      return [student.name, student.id, student.parentName, student.phone].join(' ').toLowerCase().includes(needle);
    });
  }, [rows, query, classFilter, statusFilter]);

  const active = rows.find((student) => student.id === activeId) ?? null;

  const pendingBook = rows.reduce((total, student) => total + duesFor(student).pending, 0);
  const defaulters = rows.filter((student) => duesFor(student).pending > 0).length;

  const columns = useMemo(() => {
    const base = [
      { key: 'select', label: '' },
      { key: 'student', label: 'Student' },
      { key: 'roll', label: 'Roll no' },
      { key: 'class', label: 'Class' },
      { key: 'parent', label: 'Parent' },
      { key: 'phone', label: 'Phone' },
      { key: 'address', label: 'Address' },
      { key: 'tuition', label: 'Tuition' },
      { key: 'scholarship', label: 'Scholarship %' },
      { key: 'fine', label: 'Fine' },
      { key: 'paid', label: 'Paid' },
      { key: 'pending', label: 'Pending' },
      { key: 'progress', label: 'Collected' },
      { key: 'payAmount', label: 'Pay amount' },
      { key: 'discount', label: 'Discount' },
      { key: 'waive', label: 'Waive fine' },
      { key: 'actions', label: 'Actions' },
    ];

    return can(role, 'waiveFine') ? base : base.filter((column) => column.key !== 'waive');
  }, [role]);

  function draftFor(id) {
    return drafts[id] ?? EMPTY_DRAFT;
  }

  function updateDraft(id, patch) {
    setDrafts((previous) => ({ ...previous, [id]: { ...(previous[id] ?? EMPTY_DRAFT), ...patch } }));
  }

  function toggleRow(id) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === students.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(students.map((student) => student.id)));
  }

  function openStudent(student) {
    setActiveId(student.id);
  }

  function optimisticApply(studentId, cash, upi, waiveFine) {
    const delta = Number(cash || 0) + Number(upi || 0);
    setRows((previous) =>
      previous.map((row) =>
        row.id === studentId
          ? {
              ...row,
              paidAmount: row.paidAmount + delta,
              lateFine: waiveFine ? 0 : row.lateFine,
            }
          : row,
      ),
    );
  }

  async function collect(student, payload) {
    setBusyId(student.id);
    try {
      const receipt = await postPayment({
        studentId: student.id,
        cash: payload.cash,
        upi: payload.upi,
        discount: payload.discount,
        note: payload.note,
        role,
      });

      optimisticApply(student.id, payload.cash, payload.upi, payload.waiveFine);

      if (payload.waiveFine && student.lateFine > 0) {
        await postWaiveFine({ studentId: student.id, role });
      }

      const entry = await recordAudit({
        action: 'FEE_PAYMENT',
        detail: `${receipt.receipt.receiptNo} ${receipt.receipt.mode} ${formatINR(receipt.receipt.total)} for ${student.name}`,
        role,
      });
      onAudit(entry);
      onToast(`${student.name}: receipt ${receipt.receipt.receiptNo} generated`);
      setForm({ cash: '', upi: '', discount: '', waiveFine: false, note: '' });
    } catch (error) {
      onToast(error.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function waiveFine(student) {
    setBusyId(student.id);
    try {
      const result = await postWaiveFine({ studentId: student.id, role });
      setRows((previous) => previous.map((row) => (row.id === student.id ? { ...row, lateFine: 0 } : row)));
      const entry = await recordAudit({
        action: 'FEE_WAIVE',
        detail: `Fine waiver of ${formatINR(result.waived)} processed for ${student.name}`,
        role,
      });
      onAudit(entry);
      onToast(result.waived > 0 ? `Fine waived: ${formatINR(result.waived)}` : 'No fine pending on this student');
    } catch (error) {
      onToast(error.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function remind(student) {
    try {
      await postBulkRemind({ studentIds: [student.id], role });
      onToast(`Reminder queued for ${student.parentName}`);
    } catch (error) {
      onToast(error.message, 'error');
    }
  }

  async function remindSelected() {
    try {
      const result = await postBulkRemind({ studentIds: [...selected], role });
      const entry = await recordAudit({
        action: 'BULK_REMIND',
        detail: `Reminder queued for ${result.sent} selected student(s)`,
        role,
      });
      onAudit(entry);
      onToast(`Reminder queued for ${result.sent} student(s)`);
    } catch (error) {
      onToast(error.message, 'error');
    }
  }

  function submitRowPayment(student) {
    const draft = draftFor(student.id);
    return collect(student, {
      cash: Number(draft.pay || 0),
      upi: 0,
      discount: Number(draft.discount || 0),
      waiveFine: Boolean(draft.waive),
      note: 'Counter collection',
    });
  }

  function submitDetailPayment(student) {
    return collect(student, {
      cash: form.cash,
      upi: form.upi,
      discount: form.discount,
      waiveFine: form.waiveFine,
      note: form.note,
    });
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Wallet className="h-4 w-4 text-brand-600" />
              Fee Desk
            </h2>
            <p className="text-[11px] text-slate-500">
              {school.branch} · collections open for {school.academicYear} · operator {role}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search student, parent or phone"
                className="erp-input w-60 pl-7"
              />
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <Filter className="h-3.5 w-3.5" />
            </div>
            <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="erp-input w-28">
              {CLASS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'ALL' ? 'All classes' : `Class ${option}`}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="erp-input w-36">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pending book</p>
            <p className="text-lg font-semibold text-slate-800">{`\u20B9${pendingBook.toLocaleString('en-IN')}`}</p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">Defaulters</p>
            <p className="text-lg font-semibold text-rose-700">{defaulters}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Students on desk</p>
            <p className="text-lg font-semibold text-slate-800">{rows.length}</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Selected</p>
              <p className="text-lg font-semibold text-slate-800">{selected.size}</p>
            </div>
            <button
              type="button"
              onClick={remindSelected}
              disabled={selected.size === 0}
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Send className="h-3.5 w-3.5" />
              Remind
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden border-y border-slate-200 bg-white">
        <table className="w-[2680px] table-fixed border-collapse text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`border-b border-slate-200 px-2 py-2 font-semibold ${
                    column.key === 'select' ? 'w-10' : ''
                  } ${['tuition', 'scholarship', 'fine', 'paid', 'pending'].includes(column.key) ? 'text-right' : ''}`}
                >
                  {column.key === 'select' ? (
                    <input
                      type="checkbox"
                      aria-label="Select all students"
                      checked={selected.size > 0 && selected.size === students.length}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5 rounded border-slate-300"
                    />
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((student) => {
              const rowDues = duesFor(student);
              const draft = draftFor(student.id);
              const isSelected = selected.has(student.id);

              return (
                <tr
                  key={student.id}
                  className={`border-b border-slate-100 align-top ${
                    isSelected ? 'bg-brand-50/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${student.name}`}
                      checked={isSelected}
                      onChange={() => toggleRow(student.id)}
                      className="h-3.5 w-3.5 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <p className="font-semibold leading-tight text-slate-800">{student.name}</p>
                    <p className="text-[10px] text-slate-400">{student.id}</p>
                  </td>
                  <td className="px-2 py-2 text-slate-600">{student.rollNo}</td>
                  <td className="px-2 py-2 text-slate-600">
                    {student.className}
                    {student.section}
                  </td>
                  <td className="px-2 py-2 text-slate-600">{student.parentName}</td>
                  <td className="px-2 py-2 text-slate-600">{student.phone}</td>
                  <td className="px-2 py-2 text-[10px] leading-snug text-slate-500">{student.address}</td>
                  <td className="px-2 py-2 text-right text-slate-700">{formatINR(student.tuition)}</td>
                  <td className="px-2 py-2 text-right text-slate-700">{student.scholarshipPct}%</td>
                  <td className="px-2 py-2 text-right text-slate-700">{formatINR(student.lateFine)}</td>
                  <td className="px-2 py-2 text-right text-slate-700">{formatINR(student.paidAmount)}</td>
                  <td className="px-2 py-2 text-right font-semibold text-rose-600">{formatINR(rowDues.pending)}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-slate-200">
                        <div
                          className={`h-1.5 rounded-full ${rowDues.collectedPct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${rowDues.collectedPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500">{rowDues.collectedPct}%</span>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      value={draft.pay}
                      onChange={(event) => updateDraft(student.id, { pay: event.target.value })}
                      placeholder="0"
                      className="erp-input w-24 py-1 text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      value={draft.discount}
                      onChange={(event) => updateDraft(student.id, { discount: event.target.value })}
                      placeholder="0"
                      className="erp-input w-20 py-1 text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        checked={draft.waive}
                        onChange={(event) => updateDraft(student.id, { waive: event.target.checked })}
                        className="h-3.5 w-3.5 rounded border-slate-300"
                      />
                      Fine
                    </label>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Collect payment"
                        disabled={busyId === student.id}
                        onClick={() => submitRowPayment(student)}
                        className="rounded-md bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 disabled:bg-slate-300"
                      >
                        <IndianRupee className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Reprint receipt"
                        onClick={() => onToast(`Last receipt queued to counter printer for ${student.name}`, 'info')}
                        className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Send reminder"
                        onClick={() => remind(student)}
                        className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                      >
                        <Bell className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Open student ledger"
                        onClick={() => openStudent(student)}
                        className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-sm text-slate-400">
                  No fee rows match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-1.5 text-[11px] text-slate-500">
        Showing {visibleRows.length} of {rows.length} students · {selected.size} selected · fine waivers are audited
      </div>

      {active && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40">
          <aside className="flex h-full w-[520px] flex-col bg-white shadow-2xl">
            <div className="shrink-0 border-b border-slate-200 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {active.id} · {active.feePlan}
                  </p>
                  <h3 className="text-sm font-semibold leading-tight text-slate-900">{active.name}</h3>
                  <p className="text-[11px] text-slate-500">
                    Class {active.className}
                    {active.section} · Roll {active.rollNo} · {active.parentName} · {active.phone}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 px-4 py-3">
              <p className="rounded-md bg-slate-50 px-2 py-1.5 text-[11px] leading-snug text-slate-600">{active.address}</p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-md border border-slate-200 px-2 py-1.5">
                  <p className="text-slate-500">Base tuition</p>
                  <p className="font-semibold text-slate-800">{formatINR(active.tuition)}</p>
                </div>
                <div className="rounded-md border border-slate-200 px-2 py-1.5">
                  <p className="text-slate-500">Scholarship</p>
                  <p className="font-semibold text-slate-800">
                    {active.scholarshipPct}% ({formatINR((active.tuition * active.scholarshipPct) / 100)})
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 px-2 py-1.5">
                  <p className="text-slate-500">Late fine</p>
                  <p className="font-semibold text-slate-800">{formatINR(active.lateFine)}</p>
                </div>
                <div className="rounded-md border border-slate-200 px-2 py-1.5">
                  <p className="text-slate-500">Paid to date</p>
                  <p className="font-semibold text-slate-800">{formatINR(active.paidAmount)}</p>
                </div>
                <div className="col-span-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5">
                  <p className="text-rose-600">Pending balance</p>
                  <p className="text-sm font-semibold text-rose-700">{formatINR(duesFor(active).pending)}</p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Collect payment
                </div>
                <div className="grid grid-cols-2 gap-2 px-2 py-2">
                  <div>
                    <label className="erp-label" htmlFor="cash">
                      Cash
                    </label>
                    <input
                      id="cash"
                      type="number"
                      min="0"
                      value={form.cash}
                      onChange={(event) => setForm({ ...form, cash: event.target.value })}
                      className="erp-input"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="erp-label" htmlFor="upi">
                      UPI
                    </label>
                    <input
                      id="upi"
                      type="number"
                      min="0"
                      value={form.upi}
                      onChange={(event) => setForm({ ...form, upi: event.target.value })}
                      className="erp-input"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="erp-label" htmlFor="discount">
                      Discount
                    </label>
                    <input
                      id="discount"
                      type="number"
                      min="0"
                      value={form.discount}
                      onChange={(event) => setForm({ ...form, discount: event.target.value })}
                      className="erp-input"
                      placeholder="0"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 pb-1.5 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        checked={form.waiveFine}
                        onChange={(event) => setForm({ ...form, waiveFine: event.target.checked })}
                        className="h-3.5 w-3.5 rounded border-slate-300"
                      />
                      Waive late fine
                    </label>
                  </div>
                  <div className="col-span-2">
                    <label className="erp-label" htmlFor="note">
                      Note
                    </label>
                    <input
                      id="note"
                      value={form.note}
                      onChange={(event) => setForm({ ...form, note: event.target.value })}
                      className="erp-input"
                      placeholder="Counter remark"
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 text-[11px]">
                    <span className="text-slate-500">Balance after this receipt</span>
                    <span className="font-semibold text-slate-800">
                      {`\u20B9${active.paidAmount + form.cash + form.upi}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Payment history</p>
                <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                  {active.paymentHistory.map((entry) => (
                    <li key={entry.receiptNo} className="flex items-center justify-between px-2 py-1.5 text-[11px]">
                      <span className="text-slate-500">{entry.date}</span>
                      <span className="font-mono text-[10px] text-slate-400">{entry.receiptNo}</span>
                      <span className="text-slate-600">{entry.mode}</span>
                      <span className="font-semibold text-slate-800">{formatINR(entry.amount)}</span>
                    </li>
                  ))}
                  {active.paymentHistory.length === 0 && (
                    <li className="px-2 py-1.5 text-[11px] text-slate-400">No installments recorded yet.</li>
                  )}
                </ul>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] leading-snug text-amber-800">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  Receipts are posted to the daybook immediately. Scholarship revisions are approved by the accounts
                  office and reflected from the next billing cycle.
                </span>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busyId === active.id}
                  onClick={() => submitDetailPayment(active)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
                >
                  <Receipt className="h-4 w-4" />
                  Record payment
                </button>
                <button
                  type="button"
                  disabled={busyId === active.id}
                  onClick={() => waiveFine(active)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
                >
                  Waive fine
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
