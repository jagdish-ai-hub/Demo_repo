export const ROLES = ['ADMIN', 'ACCOUNTANT', 'RECEPTIONIST'];

export const ROLE_LABELS = {
  ADMIN: 'Admin',
  ACCOUNTANT: 'Accountant',
  RECEPTIONIST: 'Receptionist',
};

export const ROLE_HINTS = {
  ADMIN: 'Full access including data reset',
  ACCOUNTANT: 'Collections, ledgers and reminders',
  RECEPTIONIST: 'Front desk collections only',
};

export const PERMISSIONS = {
  ADMIN: {
    viewStudents: true,
    collectFees: true,
    waiveFine: true,
    applyDiscount: true,
    bulkRemind: true,
    viewAudit: true,
    resetData: true,
  },
  ACCOUNTANT: {
    viewStudents: true,
    collectFees: true,
    waiveFine: true,
    applyDiscount: false,
    bulkRemind: true,
    viewAudit: true,
    resetData: false,
  },
  RECEPTIONIST: {
    viewStudents: true,
    collectFees: true,
    waiveFine: false,
    applyDiscount: false,
    bulkRemind: false,
    viewAudit: true,
    resetData: false,
  },
};

export function can(role, permission) {
  return Boolean(PERMISSIONS[role]?.[permission]);
}
