import { api } from './api';

export const AUDIT_ACTIONS = {
  FEE_PAYMENT: 'FEE_PAYMENT',
  FEE_WAIVE: 'FEE_WAIVE',
  BULK_REMIND: 'BULK_REMIND',
  ROLE_SWITCH: 'ROLE_SWITCH',
  LEDGER_REFRESH: 'LEDGER_REFRESH',
  DATA_RESET: 'DATA_RESET',
  STUDENT_VIEW: 'STUDENT_VIEW',
  NOTE: 'NOTE',
};

export const AUDIT_ACTION_LABELS = {
  FEE_PAYMENT: 'Fee payment',
  FEE_WAIVE: 'Fine waiver',
  BULK_REMIND: 'Bulk reminder',
  ROLE_SWITCH: 'Role switch',
  LEDGER_REFRESH: 'Ledger refresh',
  DATA_RESET: 'Data reset',
  STUDENT_VIEW: 'Student view',
  NOTE: 'Note',
};

export function localEntry({ action, detail, role }) {
  const now = new Date();
  return {
    id: `AUD-LOCAL-${now.getTime()}`,
    action,
    detail,
    role,
    at: now.toISOString(),
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
    pending: true,
  };
}

export async function recordAudit({ action, detail, role }) {
  try {
    const { entry } = await api('/audit', { method: 'POST', body: { action, detail, role } });
    return entry;
  } catch (error) {
    return localEntry({ action, detail, role });
  }
}

export function auditActionLabel(action) {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
