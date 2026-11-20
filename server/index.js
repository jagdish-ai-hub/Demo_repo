import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seedData.json'), 'utf8'));

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

const todayISO = () => new Date().toISOString().slice(0, 10);

function clockTime(date = new Date()) {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

function buildState() {
  const today = todayISO();
  return {
    school: { ...seed.school },
    students: seed.students.map((student) => ({
      ...student,
      paymentHistory: student.paymentHistory.map((entry) => ({ ...entry })),
    })),
    daybookLedger: seed.daybookLedger.map((entry) => ({ ...entry, date: today })),
    auditLog: seed.auditLog.map((entry) => ({
      id: `AUD-SEED-${entry.time.replace(':', '')}`,
      action: entry.action,
      detail: entry.detail,
      role: entry.role,
      at: `${today}T${entry.time}:00+05:30`,
      time: entry.time,
    })),
    meta: {
      academicYear: seed.school.academicYear,
      today,
      bootedAt: new Date().toISOString(),
      source: 'server/seedData.json',
    },
  };
}

let state = buildState();

function appendAudit(action, detail, role = 'SYSTEM') {
  const entry = {
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action,
    detail,
    role,
    at: new Date().toISOString(),
    time: clockTime(),
  };
  state.auditLog.unshift(entry);
  if (state.auditLog.length > 250) state.auditLog.length = 250;
  return entry;
}

function snapshot() {
  return {
    school: state.school,
    students: state.students,
    daybookLedger: state.daybookLedger,
    auditLog: state.auditLog,
    meta: state.meta,
  };
}

function nextReceiptNo() {
  const issued = state.daybookLedger.length + 881;
  return `RCPT-2026-${String(issued).padStart(4, '0')}`;
}

function parseAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

const api = express.Router();

api.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), students: state.students.length });
});

api.get('/bootstrap', (req, res) => {
  res.json(snapshot());
});

api.post('/fees/pay', (req, res) => {
  const body = req.body ?? {};
  const student = state.students.find((item) => item.id === body.studentId);

  if (!student) {
    return res.status(404).json({ success: false, error: 'Student record not found' });
  }

  const cash = parseAmount(body.cash);
  const upi = parseAmount(body.upi);
  const discount = parseAmount(body.discount);
  const total = Number((cash + upi).toFixed(2));

  if (total === 0 && discount === 0) {
    return res.status(400).json({ success: false, error: 'Enter a cash or UPI amount before collecting' });
  }

  const receiptNo = nextReceiptNo();
  const entry = {
    id: `TXN-${Date.now()}`,
    date: todayISO(),
    time: clockTime(),
    studentId: student.id,
    studentName: student.name,
    className: student.className,
    receiptNo,
    cash,
    upi,
    discount,
    total,
    mode: cash > 0 && upi > 0 ? 'SPLIT' : upi > 0 ? 'UPI' : 'CASH',
    collectedBy: body.role ?? 'ADMIN',
    note: typeof body.note === 'string' ? body.note.slice(0, 140) : '',
  };

  state.daybookLedger.unshift(entry);

  appendAudit(
    'FEE_PAYMENT',
    `${receiptNo} ${entry.mode} INR ${total.toLocaleString('en-IN')} for ${student.name} (${student.id})`,
    body.role ?? 'ADMIN',
  );

  res.json({ success: true, receipt: entry });
});

api.post('/fees/waive-fine', (req, res) => {
  const body = req.body ?? {};
  const student = state.students.find((item) => item.id === body.studentId);

  if (!student) {
    return res.status(404).json({ success: false, error: 'Student record not found' });
  }

  const waived = student.lateFine;
  student.lateFine = 0;

  appendAudit(
    'FEE_WAIVE',
    waived > 0
      ? `Late fine INR ${waived.toLocaleString('en-IN')} waived for ${student.name} (${student.id})`
      : `Fine waiver requested for ${student.name} (${student.id}) - nothing to waive`,
    body.role ?? 'ADMIN',
  );

  res.json({ success: true, waived, lateFine: student.lateFine });
});

api.post('/fees/bulk-remind', (req, res) => {
  const ids = Array.isArray(req.body?.studentIds) ? req.body.studentIds : [];
  const role = req.body?.role ?? 'ADMIN';
  const stamp = new Date().toISOString();

  let sent = 0;
  state.students.forEach((student) => {
    if (ids.includes(student.id)) {
      student.lastReminderAt = stamp;
      sent += 1;
    }
  });

  appendAudit('BULK_REMIND', `Fee reminder queued for ${sent} student(s)`, role);
  res.json({ success: true, sent });
});

api.post('/audit', (req, res) => {
  const body = req.body ?? {};
  const entry = appendAudit(
    typeof body.action === 'string' ? body.action : 'NOTE',
    typeof body.detail === 'string' ? body.detail.slice(0, 200) : '',
    body.role ?? 'ADMIN',
  );
  res.json({ success: true, entry });
});

api.post('/reset', (req, res) => {
  state = buildState();
  appendAudit('DATA_RESET', 'Sandbox data restored from seed', 'ADMIN');
  res.json({ success: true, ...snapshot() });
});

api.use((req, res) => {
  res.status(404).json({ success: false, error: `No API route for ${req.method} ${req.originalUrl}` });
});

app.use('/api', api);

if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  app.use(
    express.static(DIST_DIR, {
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.status(503).type('text/plain').send('Frontend build missing. Run "npm run build" before starting the server.');
  });
}

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Delahio ERP listening on port ${PORT}`);
  console.log(`Loaded ${state.students.length} students from seedData.json`);
});
