# 🛡️ CareOps — Home Care & Operational Task Dashboard

A high-contrast, instant-response web application engineered to eliminate administrative friction, logging errors, and information loss during the coordination and execution of home care services.

Built on the **BRNP Stack** (**B**ootstrap, **R**eact, **N**ext.js, **P**ostgreSQL) and strictly designed around **Jakob Nielsen's 10 Usability Heuristics (NN/g)**.

---

## 🎯 The Real-World Problem

In home care and field assistance, caregivers operate under pressure, on the move, and frequently use mobile devices one-handed. Paper logs or cluttered interfaces lead to:

* Missed or duplicated critical tasks (medication, nutrition, mobility).
* Lack of real-time timestamp traceability across shift handovers.
* Friction when reporting incidents quickly without interrupting care delivery.

---

## 🛠️ Architecture & Tech Stack (BRNP)

This project implements a full-stack monolithic architecture with end-to-end type safety:

* **Frontend:** React (Server Components + Client Components leveraging `useOptimistic` for instant UI feedback).
* **Styling & UI:** Bootstrap 5 & React-Bootstrap (focused on accessibility, high contrast, responsive grids, and generous touch targets).
* **Backend / Orchestration:** Next.js (App Router & Server Actions for secure mutations without an intermediate REST API).
* **Database:** PostgreSQL (referential integrity for shifts, critical tasks, and audit logs).
* **ORM:** Drizzle ORM / Prisma (type-safe queries and schema migrations).

---

## 🧭 UX Design Principles (Nielsen's 10 Usability Heuristics)

Every technical and visual decision in this repository maps directly to an established usability principle:

1. **Visibility of System Status:** Uses React's `useOptimistic` hook to reflect state changes instantaneously while PostgreSQL persists the record, paired with shift progress bars and semantic Bootstrap badges.
2. **Match Between System and the Real World:** Uses natural operational language (*"Afternoon Shift"*, *"Medication"*) and chronological daily ordering rather than internal database IDs.
3. **User Control and Freedom:** Displays a Bootstrap *Toast* notification with a 5-second **"Undo"** action after checking off a task, allowing accidental taps to be reverted immediately.
4. **Consistency and Standards:** Enforces strict Bootstrap color semantics (green = completed, yellow = caution, red = critical alert) and predictable action placement.
5. **Error Prevention:** Server-side validation blocks closing a shift if any task marked as `critical` remains incomplete or unjustified, alongside confirmation modals for destructive actions.
6. **Recognition Rather Than Recall:** Streamlines incident reporting using quick-select *chips* (*"No issues"*, *"Low supplies"*, *"Schedule change"*) so users don't have to type from scratch.
7. **Flexibility and Efficiency of Use:** Mobile-first, thumb-friendly ergonomics (`btn-lg`, spacious card padding) plus bulk-completion shortcuts for routine, non-critical tasks.
8. **Aesthetic and Minimalist Design:** Clean primary view displaying only 3 essential data points per task (action, time slot, status); extended notes and audit history are tucked inside `Accordion` components.
9. **Help Users Recognize, Diagnose, and Recover from Errors:** Graceful handling of Server Action or network failures with human-readable alerts and immediate retry triggers without losing on-screen state.
10. **Help and Documentation:** Contextual tooltips and popovers (`?`) next to complex care protocols for instant reference without leaving the active workflow.

---

## 📂 Project Structure

```text
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Global Bootstrap CSS import and root typography
│   │   ├── page.tsx            # Active shift dashboard (Server Component)
│   │   └── actions/
│   │       ├── tasks.ts        # Server Actions (toggleTask, undoTask, bulkComplete)
│   │       └── shifts.ts       # Server Actions (validateShiftClose, reportIncident)
│   ├── components/
│   │   ├── ui/                 # React-Bootstrap client wrappers ("use client")
│   │   ├── TaskCard.tsx        # Touch-friendly task card with collapsible details
│   │   ├── UndoToast.tsx       # Quick-revert notification control (Heuristic #3)
│   │   └── IncidentModal.tsx   # Quick-chip incident selector (Heuristic #6)
│   └── db/
│       ├── index.ts            # PostgreSQL connection pool
│       └── schema.ts           # Relational schema (shifts, tasks, task_logs)
├── drizzle.config.ts           # Migration configuration
└── package.json
```

---

## 🗄️ Database Schema (PostgreSQL)

* **`shifts`:** `id`, `caregiver_name`, `patient_alias`, `start_time`, `end_time`, `status` (`ACTIVE` | `CLOSED`).
* **`tasks`:** `id`, `shift_id`, `title`, `description`, `scheduled_slot`, `is_critical` (boolean), `is_completed` (boolean), `completed_at`.
* **`task_logs` (Audit Trail):** `id`, `task_id`, `action` (`COMPLETED` | `REVERTED` | `INCIDENT`), `note`, `created_at`.

---

## 🚀 Getting Started

### 1. Clone and install dependencies

```bash
git clone https://github.com/your-username/careops-brnp.git
cd careops-brnp
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the root directory:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/careops_db"
```

### 3. Push the schema to PostgreSQL

```bash
npx drizzle-kit push
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser (enable mobile viewport emulation in DevTools to test one-handed touch ergonomics).

---

## 🧪 Recommended QA & Agent Testing Flows

When running autonomous browser agents or integration tests in **Antigravity / VS Code**, validate the following core scenarios:

1. **Optimistic UI Response:** Toggle a task and verify visual feedback renders in `< 50ms`.
2. **State Reversion (Undo):** Click **"Undo"** inside the toast notification and confirm both the UI and the `task_logs` audit table in PostgreSQL record the rollback.
3. **Critical Safety Guardrail:** Attempt to close an active shift while an `is_critical = true` task is still pending, ensuring the Server Action blocks closure and returns a clear explanation.