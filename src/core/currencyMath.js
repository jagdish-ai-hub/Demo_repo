export const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function formatINR(value) {
  const amount = toNumber(value);
  const sign = amount < 0 ? '-' : '';
  return `${sign}\u20B9${Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatPercent(value) {
  const amount = toNumber(value);
  return `${amount > 0 ? '+' : ''}${Math.round(amount)}%`;
}

/**
 * Standard ERP net payable calculation.
 * Consumed by the student directory, the daybook summaries and the reminder
 * template builder so every module reports the same outstanding figure.
 */
export function calculateStudentDues(student) {
  const tuition = toNumber(student.tuition);
  const lateFine = toNumber(student.lateFine);
  const paidAmount = toNumber(student.paidAmount);
  const scholarshipPct = toNumber(student.scholarshipPct);

  const netPayable = (tuition + lateFine - paidAmount) * (1 - scholarshipPct / 100);

  return {
    grossPayable: tuition + lateFine,
    netPayable,
    pending: netPayable,
    isDefaulter: netPayable > 0,
  };
}

/**
 * Collection progress shown on the directory cards.
 */
export function collectionProgress(student) {
  const payable = toNumber(student.tuition) + toNumber(student.lateFine);
  if (payable <= 0) return 100;

  const { pending } = calculateStudentDues(student);
  return Math.round(((payable - pending) / payable) * 100);
}

export function summariseLedger(entries = []) {
  return entries.reduce(
    (acc, entry) => ({
      cash: round2(acc.cash + toNumber(entry.cash)),
      upi: round2(acc.upi + toNumber(entry.upi)),
      discount: round2(acc.discount + toNumber(entry.discount)),
      total: round2(acc.total + toNumber(entry.total)),
      count: acc.count + 1,
    }),
    { cash: 0, upi: 0, discount: 0, total: 0, count: 0 },
  );
}
