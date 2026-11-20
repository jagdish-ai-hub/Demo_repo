import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BookOpen,
  GraduationCap,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import StudentDirectory from './modules/01-student-master/StudentDirectory';
import FeeDesk from './modules/02-fee-desk/FeeDesk';
import DaybookLedger from './modules/03-ledger-reports/DaybookLedger';
import AuditDrawer from './modules/04-audit-log/AuditDrawer';
import { getBootstrap, postReset } from './core/api';
import { ROLE_HINTS, ROLE_LABELS, ROLES } from './core/permissions';
import { recordAudit } from './core/auditLogger';

const MODULES = [
  { id: 'students', label: 'Student Master', icon: Users },
  { id: 'fee-desk', label: 'Fee Desk', icon: Wallet },
  { id: 'ledger', label: 'Daybook & Reports', icon: BookOpen },
];

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [role, setRole] = useState('ADMIN');
  const [activeModule, setActiveModule] = useState('fee-desk');
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLog, setAuditLog] = useState([]);
  const [toast, setToast] = useState(null);

  const applyBootstrap = useCallback((payload) => {
    setData(payload);
    setAuditLog(payload.auditLog ?? []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getBootstrap();
      applyBootstrap(payload);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [applyBootstrap]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message, tone = 'success') => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  const pushAudit = useCallback((entry) => {
    if (!entry) return;
    setAuditLog((previous) => [entry, ...previous]);
  }, []);

  async function handleRoleChange(nextRole) {
    setRole(nextRole);
    const entry = await recordAudit({
      action: 'ROLE_SWITCH',
      detail: `Operating role changed to ${ROLE_LABELS[nextRole]}`,
      role: nextRole,
    });
    pushAudit(entry);
    showToast(`Signed in as ${ROLE_LABELS[nextRole]}`, 'info');
  }

  async function handleReset() {
    try {
      const payload = await postReset();
      applyBootstrap(payload);
      showToast('Sandbox data restored from seed');
    } catch (resetError) {
      showToast(resetError.message, 'error');
    }
  }

  const counts = useMemo(() => {
    const students = data?.students ?? [];
    return {
      total: students.length,
      blocked: students.filter((student) => student.examBlocked).length,
      receipts: data?.daybookLedger?.length ?? 0,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="grid h-screen place-items-center bg-slate-100">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <RefreshCcw className="h-6 w-6 animate-spin" />
          <p className="text-sm font-medium">Loading Delahio ERP workspace…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="grid h-screen place-items-center bg-slate-100 px-6">
        <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-rose-600">Could not reach the ERP API</p>
          <p className="mt-2 text-xs text-slate-500">{error ?? 'Empty bootstrap response'}</p>
          <button
            type="button"
            onClick={load}
            className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100">
      <header className="shrink-0 bg-brand-700 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/15">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Delahio School ERP</h1>
              <p className="text-[11px] text-brand-100">
                {data.school.branch} · Academic year {data.school.academicYear} · {data.school.feeCycle} fee cycle
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
              <ShieldCheck className="ml-1 h-4 w-4 text-brand-100" />
              {ROLES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleRoleChange(item)}
                  title={ROLE_HINTS[item]}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                    role === item ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-100 hover:bg-white/10'
                  }`}
                >
                  {ROLE_LABELS[item]}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setAuditOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-white/20 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-50 hover:bg-white/10"
            >
              <Activity className="h-3.5 w-3.5" />
              Activity
              <span className="rounded-full bg-white/20 px-1.5 text-[10px]">{auditLog.length}</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-md border border-white/20 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-50 hover:bg-white/10"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset data
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/10 px-5">
          <nav className="flex items-stretch gap-1">
            {MODULES.map((module) => {
              const Icon = module.icon;
              const active = activeModule === module.id;
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => setActiveModule(module.id)}
                  className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
                    active ? 'border-white text-white' : 'border-transparent text-brand-100 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {module.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 text-[11px] text-brand-100">
            <span>{counts.total} students</span>
            <span className="h-3 w-px bg-white/20" />
            <span>{counts.blocked} exam blocked</span>
            <span className="h-3 w-px bg-white/20" />
            <span>{counts.receipts} receipts today</span>
            <span className="h-3 w-px bg-white/20" />
            <span className="rounded-full bg-white/10 px-2 py-0.5">Sandbox · in-memory data</span>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeModule === 'students' && <StudentDirectory students={data.students} role={role} />}
        {activeModule === 'fee-desk' && (
          <FeeDesk
            students={data.students}
            school={data.school}
            role={role}
            onAudit={pushAudit}
            onToast={showToast}
          />
        )}
        {activeModule === 'ledger' && (
          <DaybookLedger
            ledger={data.daybookLedger}
            students={data.students}
            role={role}
            onRefresh={load}
            onToast={showToast}
          />
        )}
      </main>

      <AuditDrawer open={auditOpen} onClose={() => setAuditOpen(false)} entries={auditLog} role={role} />

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[60] max-w-sm rounded-lg border px-4 py-2.5 text-sm shadow-xl ${
            toast.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : toast.tone === 'info'
                ? 'border-slate-200 bg-white text-slate-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
