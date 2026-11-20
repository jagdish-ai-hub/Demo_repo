import { useMemo, useState } from 'react';
import { Banknote, BookOpen, RefreshCcw, Smartphone, TrendingUp } from 'lucide-react';
import { calculateStudentDues, formatINR, summariseLedger } from '../../core/currencyMath';

export default function DaybookLedger({ ledger, students, role, onRefresh, onToast }) {
  const [modeFilter, setModeFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const rows = useMemo(
    () => (modeFilter === 'ALL' ? ledger : ledger.filter((entry) => entry.mode === modeFilter)),
    [ledger, modeFilter],
  );

  const totals = useMemo(() => summariseLedger(ledger), [ledger]);

  const defaulters = useMemo(
    () =>
      students
        .map((student) => ({ student, dues: calculateStudentDues(student) }))
        .filter((row) => row.dues.pending > 0)
        .sort((a, b) => b.dues.pending - a.dues.pending)
        .slice(0, 6),
    [students],
  );

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
      onToast('Daybook refreshed from the ledger service');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <BookOpen className="h-4 w-4 text-brand-600" />
              Daybook &amp; Reports
            </h2>
            <p className="text-[11px] text-slate-500">
              Today's counter collection, receipt register and defaulter summary · operator {role}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select value={modeFilter} onChange={(event) => setModeFilter(event.target.value)} className="erp-input w-32">
              <option value="ALL">All modes</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="SPLIT">Split</option>
            </select>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <TrendingUp className="h-3 w-3" /> Today's collection
            </p>
            <p className="text-lg font-semibold text-slate-800">{formatINR(totals.total)}</p>
            <p className="text-[10px] text-slate-400">{totals.count} receipts</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              <Banknote className="h-3 w-3" /> Cash
            </p>
            <p className="text-lg font-semibold text-emerald-800">{formatINR(totals.cash)}</p>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
              <Smartphone className="h-3 w-3" /> UPI
            </p>
            <p className="text-lg font-semibold text-sky-800">{formatINR(totals.upi)}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Discounts issued</p>
            <p className="text-lg font-semibold text-amber-800">{formatINR(totals.discount)}</p>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-3 overflow-auto bg-slate-100 p-3">
        <div className="col-span-2 flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
          <div className="shrink-0 border-b border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Receipt register
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Time</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Receipt</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Student</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Mode</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">Cash</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">UPI</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">Discount</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">Total</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">By</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500">{entry.time}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-500">{entry.receiptNo}</td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-800">{entry.studentName}</p>
                      <p className="text-[10px] text-slate-400">
                        {entry.className} · {entry.note}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`erp-chip ${
                          entry.mode === 'CASH'
                            ? 'bg-emerald-100 text-emerald-700'
                            : entry.mode === 'UPI'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-violet-100 text-violet-700'
                        }`}
                      >
                        {entry.mode}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatINR(entry.cash)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatINR(entry.upi)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatINR(entry.discount)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatINR(entry.total)}</td>
                    <td className="px-3 py-2 text-[10px] uppercase tracking-wide text-slate-500">{entry.collectedBy}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-400">
                      No receipts for this mode yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
          <div className="shrink-0 border-b border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Defaulter summary
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-auto">
            {defaulters.map(({ student, dues }) => (
              <li key={student.id} className="px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold leading-tight text-slate-800">{student.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {student.id} · Class {student.className}
                      {student.section} · {student.phone}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-rose-600">{formatINR(dues.pending)}</span>
                </div>
              </li>
            ))}
            {defaulters.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-slate-400">No pending balances.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
