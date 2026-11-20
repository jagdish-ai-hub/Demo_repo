import { useMemo, useState } from 'react';
import { BadgeCheck, Search, ShieldAlert, Users } from 'lucide-react';
import { calculateStudentDues, collectionProgress, formatINR } from '../../core/currencyMath';

const CLASS_OPTIONS = ['ALL', '8', '9', '10', '12'];

const STATUS_OPTIONS = [
  { id: 'ALL', label: 'All students' },
  { id: 'ELIGIBLE', label: 'Exam eligible' },
  { id: 'BLOCKED', label: 'Exam blocked' },
];

export default function StudentDirectory({ students, role }) {
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return students.filter((student) => {
      if (classFilter !== 'ALL' && student.className !== classFilter) return false;
      if (statusFilter === 'ELIGIBLE' && student.examBlocked) return false;
      if (statusFilter === 'BLOCKED' && !student.examBlocked) return false;
      if (!needle) return true;

      return [student.name, student.id, student.parentName, student.phone]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [students, query, classFilter, statusFilter]);

  const totals = useMemo(
    () =>
      students.reduce(
        (acc, student) => {
          const dues = calculateStudentDues(student);
          return {
            pending: acc.pending + dues.pending,
            blocked: acc.blocked + (student.examBlocked ? 1 : 0),
            scholarships: acc.scholarships + (student.scholarshipPct > 0 ? 1 : 0),
          };
        },
        { pending: 0, blocked: 0, scholarships: 0 },
      ),
    [students],
  );

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Users className="h-4 w-4 text-brand-600" />
              Student Master
            </h2>
            <p className="text-[11px] text-slate-500">
              {rows.length} of {students.length} records · signed in as {role}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, ID, parent, phone"
                className="erp-input w-64 pl-7"
              />
            </div>

            <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="erp-input w-28">
              {CLASS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'ALL' ? 'All classes' : `Class ${option}`}
                </option>
              ))}
            </select>

            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="erp-input w-40">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Outstanding (all classes)</p>
            <p className="text-lg font-semibold text-slate-800">{formatINR(totals.pending)}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Exam blocked defaulters</p>
            <p className="text-lg font-semibold text-amber-800">{totals.blocked}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Scholarship holders</p>
            <p className="text-lg font-semibold text-emerald-800">{totals.scholarships}</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Student</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Class</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Roll no</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Parent / phone</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Scholarship</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">Tuition</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">Paid</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">Pending</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Collected</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Exam status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((student) => {
              const dues = calculateStudentDues(student);
              const progress = collectionProgress(student);

              return (
                <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <p className="font-semibold text-slate-800">{student.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {student.id} · {student.feePlan}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {student.className}
                    {student.section}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{student.rollNo}</td>
                  <td className="px-3 py-2">
                    <p className="text-slate-700">{student.parentName}</p>
                    <p className="text-[11px] text-slate-400">{student.phone}</p>
                  </td>
                  <td className="px-3 py-2">
                    {student.scholarshipPct > 0 ? (
                      <span className="erp-chip bg-emerald-100 text-emerald-700">
                        <BadgeCheck className="h-3 w-3" />
                        {student.scholarshipPct}% scholarship
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatINR(student.tuition)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatINR(student.paidAmount)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${dues.pending > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatINR(dues.pending)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-slate-200">
                        <div
                          className={`h-1.5 rounded-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-500">{progress}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {student.examBlocked ? (
                      <span className="erp-chip bg-rose-100 text-rose-700">
                        <ShieldAlert className="h-3 w-3" />
                        Exam blocked - fee defaulter
                      </span>
                    ) : (
                      <span className="erp-chip bg-emerald-100 text-emerald-700">
                        <BadgeCheck className="h-3 w-3" />
                        Exam eligible
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-sm text-slate-400">
                  No students match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
