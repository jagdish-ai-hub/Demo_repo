# Delahio School ERP

A single-service school ERP for a mid-sized Indian school: student master, fee desk
collections, daybook reporting and an activity log. Express serves the JSON API and
the compiled React frontend from the same process, so the whole app deploys as one
web service.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, Vite 5, TailwindCSS 3, lucide-react |
| Backend | Node.js 20, Express 4 |
| Data | In-memory state hydrated from `server/seedData.json` |
| Deploy | Single Render web service (`render.yaml`) |

Data is intentionally **in-memory**: every restart (or `POST /api/reset`) restores the
40 seeded student records, today's daybook and the activity log. That keeps the sandbox
safe to hand around without a database.

## Quick start

```bash
npm install
npm run build     # compiles the Vite frontend into dist/
npm start         # Express on http://localhost:3000
```

For frontend work with hot reload, run the API and Vite side by side:

```bash
npm run dev:api   # terminal 1, Express on :3000
npm run dev       # terminal 2, Vite on :5173 (proxies /api to :3000)
```

Requirements: Node.js 20+ and npm 10+.

## Modules

| Route (tab) | File | Purpose |
| --- | --- | --- |
| Student Master | `src/modules/01-student-master/StudentDirectory.jsx` | Directory, scholarships, exam eligibility |
| Fee Desk | `src/modules/02-fee-desk/FeeDesk.jsx` | Counter collections, fines, discounts, bulk reminders |
| Daybook & Reports | `src/modules/03-ledger-reports/DaybookLedger.jsx` | Today's cash/UPI split, receipts, defaulters |
| Activity | `src/modules/04-audit-log/AuditDrawer.jsx` | Session audit trail drawer |

Shared logic lives in `src/core/`: `currencyMath.js` (money helpers and dues),
`permissions.js` (role matrix), `api.js` (fetch wrapper) and `auditLogger.js`
(client-side audit helper).

The top navigation switches between three operating roles: `ADMIN`, `ACCOUNTANT` and
`RECEPTIONIST`. The matrix in `src/core/permissions.js` describes what each role may do.

## API

All routes are JSON and mounted under `/api`.

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/bootstrap` | Full snapshot: school, students, daybook, audit log |
| `POST` | `/api/fees/pay` | Record a cash/UPI collection and issue a receipt |
| `POST` | `/api/fees/waive-fine` | Clear the late fine on a student |
| `POST` | `/api/fees/bulk-remind` | Queue fee reminders for a set of student IDs |
| `POST` | `/api/audit` | Append an activity log entry |
| `POST` | `/api/reset` | Restore the seed snapshot |

Example:

```bash
curl -X POST http://localhost:3000/api/fees/pay \
  -H 'Content-Type: application/json' \
  -d '{"studentId":"STU-2025-013","cash":2000,"upi":1500,"role":"ADMIN"}'
```

## Seed data

`server/seedData.json` holds 40 students across Classes 8, 9, 10 and 12 with tuition,
scholarship percentage, late fine, amount paid, payment history, guardian contact,
address and exam eligibility. It also carries a small daybook and audit trail so the
reports are not empty on first load.

## Deploy to Render

The repository includes a Render Blueprint (`render.yaml`):

1. Push the repository to GitHub.
2. In the Render dashboard choose **New → Blueprint** and point it at the repo.
3. Render runs `npm ci && npm run build`, then `npm start`.

Manual setup works the same way: create a Web Service with runtime **Node**, build
command `npm ci && npm run build`, start command `npm start`, and set `NODE_VERSION=20.20.2`.

---

# Intern assessment brief

**Time:** 3 days. Please spend about **10–12 hours** in total.
**You are not expected to finish everything.** What you choose to do first is part of the test.
**AI tools are allowed** (ChatGPT, Claude, Copilot, Cursor, anything).

## The situation

Delahio Public School uses this ERP at the front desk on a **1366×768 laptop**. Two clerks and a
receptionist share it, often with parents waiting in a queue.

The school staff have stopped trusting the screen. Below are their complaints. They describe
**what they saw**, not why it happened. Some complaints have the same cause. Some problems have no
complaint yet.

Use **Reset data** in the header to restore the starting data at any time.

## Running the app

- **Run it locally. This is required.** Follow "Quick start" above. Do all your testing locally.
- **Deploy on Render. This is optional.** It's a nice extra if you want to share a live link; follow
  "Deploy to Render" above (the free plan is enough). Note: Render's free plan sleeps when
  nobody uses it, and on wake-up all data resets to the starting data. A payment "disappearing"
  on Render may be that, not a bug. Check bugs locally.

## Step 1: Investigate before you fix

Your **first commit** must be a file `TRIAGE.md`, written **before** you change any code:

- For each complaint: can you reproduce it? Write the steps and what you saw.
- Your guess at the cause (file and line if you can). It's fine if your guess turns out wrong.
- Anything else you noticed that nobody complained about.
- The order you will work in, and why.

## The complaints

**1. "I can't reach the payment button."** (Front-desk clerk)
> On the counter laptop I can only see the first few students. The list won't scroll. When
> Venkatanarasimharajuvaripeta Subramanium's father came to pay, I opened his record but the
> "Record payment" button was not on the screen. I had to send him away.

**2. "Two screens show two different amounts."** (Accounts office)
> Fee Desk says Diya Nair owes ₹10,500. Student Master says ₹15,000. Which one do I tell the parent?

**3. "The payment disappeared."** (Front-desk clerk)
> I took ₹10,000 cash from Kabir Menon's father and got a receipt on screen. After the page
> refreshed, Kabir shows ₹0 paid and is still blocked from exams. The money is in my drawer.

**4. "The receptionist waived a fine."** (Principal's office)
> Our audit found a late fine waived and a discount given while the receptionist was using the
> system. Receptionists are not allowed to do either. How did this happen? Can it happen again?

**5. "40 parents got a reminder."** (Accountant)
> I filtered to Class 12, ticked "select all" and pressed Remind. Parents from every class called us.
> I only meant the 10 students on my screen.

**6. "We took money we shouldn't have."** (Accounts office)
> Riya Agarwal's family had already paid too much, and the counter still accepted another payment.
> Some screens show her as owing a negative amount, as if she were a defaulter.

**7. "Fine waivers need a reason."** (Principal's office, new feature)
> From now on, waiving a late fine must need a written reason, and that reason must show in the
> Activity log. No reason, no waiver.

**8. "Parents pay part cash, part UPI."** (Accountant, new feature?)
> One receipt should allow cash and UPI together, and the Daybook must show the two amounts
> separately so the cash drawer matches.
>
> *Before building anything, check what the app already does, and tell us.*

**9. "Redesign the Fee Desk."** (School management)
> The Fee Desk is a very wide table with an input box in every row. Please make it fast to use
> with a queue at the counter:
> - A simple list: student, class, parent phone, amount due, a status badge, **one** action button.
> - Quick search and filters (class, overdue, cleared, credit).
> - A side panel for one student: fee breakdown, payment history, payment form.
> - Everything usable on 1366×768: nothing cut off, no sideways scrolling to reach the main button.
>   Test it with the student who has 15 payments.

## School accounting rules

1. Scholarships apply to **base tuition only**. Late fines are never reduced by a scholarship.
2. **Amount due** = `round2(tuition × (1 − scholarshipPct / 100) + lateFine − paidAmount)`.
3. Always show two decimal places. No long decimals like `0.30000000004` on screen.
4. A negative amount due is a **credit**. Show it as `Credit / Refund Due ₹X`, and don't accept
   more money from that student.
5. A student can sit exams when the amount due reaches zero. This must still be true after a refresh.
6. The Daybook is the official record. Its cash, UPI and receipt totals must match the student balances.
7. A payment larger than the amount due is rejected.
8. What each role may do is defined in `src/core/permissions.js`.

**If the rules, the code and the data disagree, decide what is correct, fix it, and explain
your decision in NOTES.md.** Don't quietly pick one.

## What to submit

1. **A public GitHub repo link** with your work. Create your own new repo; don't fork.
   Optional: a live Render link (see "Running the app" below).
2. **Small commits** with clear messages. We read the history. `TRIAGE.md` comes first.
3. **`NOTES.md`**:
   - for each complaint: the cause, how you reproduced it, what you changed, how you checked it;
   - problems you found that nobody complained about;
   - decisions you made where things were unclear;
   - what you did **not** do, and why.
4. **`AI_LOG.md`** (see below).
5. `npm run build` and `npm start` work with no errors in the browser console.

## AI_LOG.md: how you used AI

We are not checking **whether** you used AI. We want to see **how** you think when you use it.

Pick **3 to 5 important moments** and for each one write:

- **What I asked:** your question or prompt.
- **What the AI said:** a short summary of its answer.
- **What I did:** did you use it as-is, change it, or throw it away? How did you check it was right?

Include **at least one time the AI was wrong** or gave you something incomplete, and how you
noticed. Example:

> **Asked:** "Write a regex to check an Indian mobile number."
> **AI said:** `^\+91[6-9]\d{9}$`
> **I did:** I tested it on a phone number from the seed data, `+91 98450 11201`, and it failed
> because of the spaces. I changed it to allow spaces and tested 5 numbers from the seed.

## Follow-up call (30 minutes)

If you are shortlisted, you will share your screen and:

- explain one fix from start to finish;
- make one small change we ask for, **without AI**.

## Rules

- Don't delete modules or students to make the screen fit.
- Keep the in-memory Express API. No database, no new services.
- Keep the current look (Tailwind, slate/brand colours, lucide icons).
- If something is unclear, make a sensible decision and write it down.
