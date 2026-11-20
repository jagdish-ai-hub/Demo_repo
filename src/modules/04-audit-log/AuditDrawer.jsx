import { useMemo, useState } from 'react';
import { Activity, X } from 'lucide-react';
import { AUDIT_ACTION_LABELS, auditActionLabel } from '../../core/auditLogger';
import { ROLE_LABELS } from '../../core/permissions';

const ACTION_TONE = {
  FEE_PAYMENT: 'bg-emerald-100 text-emerald-700',
  FEE_WAIVE: 'bg-amber-100 text-amber-700',
  BULK_REMIND: 'bg-sky-100 text-sky-700',
  ROLE_SWITCH: 'bg-violet-100 text-violet-700',
  LEDGER_REFRESH: 'bg-slate-200 text-slate-700',
  DATA_RESET: 'bg-rose-100 text-rose-700',
  STUDENT_VIEW: 'bg-slate-200 text-slate-700',
  NOTE: 'bg-slate-200 text-slate-700',
};

function formatWhen(entry) {
  if (!entry.at) return entry.time ?? '';
  const date = new Date(entry.at);
  if (Number.isNaN(date.getTime())) return entry.time ?? '';
  return `${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · ${entry.time ?? date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

export default function AuditDrawer({ open, onClose, entries, role }) {
  const [actionFilter, setActionFilter] = useState('ALL');

  const rows = useMemo(
    () => (actionFilter === 'ALL' ? entries : entries.filter((entry) => entry.action === actionFilter)),
    [entries, actionFilter],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close activity log"
        onClick={onClose}
        className="flex-1 bg-slate-900/40"
      />
      <aside className="flex h-full w-[420px] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Activity className="h-4 w-4 text-brand-600" />
              Activity log
            </h2>
            <p className="text-[11px] text-slate-500">
              {rows.length} of {entries.length} events · viewer role {ROLE_LABELS[role] ?? role}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-200 px-4 py-2">
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="erp-input w-full"
          >
            <option value="ALL">All activity</option>
            {Object.keys(AUDIT_ACTION_LABELS).map((action) => (
              <option key={action} value={action}>
                {AUDIT_ACTION_LABELS[action]}
              </option>
            ))}
          </select>
        </div>

        <ol className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {rows.map((entry) => (
            <li key={entry.id} className="relative border-l border-slate-200 pb-4 pl-4 last:pb-0">
              <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500" />
              <div className="flex items-center gap-2">
                <span className={`erp-chip ${ACTION_TONE[entry.action] ?? 'bg-slate-200 text-slate-700'}`}>
                  {auditActionLabel(entry.action)}
                </span>
                <span className="text-[10px] text-slate-400">{formatWhen(entry)}</span>
              </div>
              <p className="mt-1 text-xs leading-snug text-slate-700">{entry.detail}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                {ROLE_LABELS[entry.role] ?? entry.role ?? 'SYSTEM'}
                {entry.pending ? ' · sync pending' : ''}
              </p>
            </li>
          ))}

          {rows.length === 0 && (
            <li className="py-10 text-center text-sm text-slate-400">No activity recorded for this filter.</li>
          )}
        </ol>

        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
          Audit entries are retained for the current sandbox session.
        </div>
      </aside>
    </div>
  );
}
