# Super Admin Role + Day View — Teljes Implementációs Utasítás

> **Projekt:** ETM (Visoro Task Manager) — "Antigravity"
> **Cél:** Új `superadmin` szerep bevezetése és egy "Napi nézet" (Day View) oldal, ahol a superadmin látja az összes munkatárs aznapi feladatait személyenként csoportosítva, átrendezhető sorrendben, személyenkénti branded PDF exporttal.

---

## Áttekintés

### Érintett fájlok

| # | Fájl | Művelet |
|---|------|---------|
| 1 | `server/src/database/migrations/031_add_superadmin_role.sql` | **ÚJ** |
| 2 | `server/src/types/index.ts` | **MÓDOSÍTÁS** |
| 3 | `client/src/types/index.ts` | **MÓDOSÍTÁS** |
| 4 | `server/src/middleware/auth.ts` | **MÓDOSÍTÁS** |
| 5 | `server/src/routes/dayView.ts` | **ÚJ** |
| 6 | `server/src/app.ts` | **MÓDOSÍTÁS** |
| 7 | `client/src/components/auth/ProtectedRoute.tsx` | **MÓDOSÍTÁS** |
| 8 | `client/src/components/layout/Layout.tsx` | **MÓDOSÍTÁS** |
| 9 | `client/src/App.tsx` | **MÓDOSÍTÁS** |
| 10 | `client/src/services/api.ts` | **MÓDOSÍTÁS** |
| 11 | `client/src/components/dayview/DayViewPage.tsx` | **ÚJ** |

### Nem szükséges új npm dependency
- `@hello-pangea/dnd` — már telepítve (drag & drop)
- `pdfkit` — már telepítve a szerveren (PDF generálás)
- `@tanstack/react-query` — már telepítve (adat fetching)
- `lucide-react` — már telepítve (ikonok)
- `date-fns` — már telepítve (dátum formázás)
- `axios` — már telepítve (`api` instance a `services/api.ts`-ben)

---

## 1. lépés — Database Migration

### Fájl: `server/src/database/migrations/031_add_superadmin_role.sql` (ÚJ)

Hozd létre ezt az új fájlt:

```sql
-- Migration 031: Add superadmin role
-- Adds 'superadmin' value to the existing user_role PostgreSQL enum type
-- and promotes the specified user to superadmin.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin' BEFORE 'admin';

-- Set Robert Ledenyi as superadmin
UPDATE users
SET role = 'superadmin', updated_at = NOW()
WHERE email = 'ledenyi.robert@visoro-global.ro';
```

**Megjegyzések:**
- A `BEFORE 'admin'` biztosítja, hogy a superadmin az enum első eleme legyen (hierarchia)
- `IF NOT EXISTS` megakadályozza a dupla futtatás hibáját
- A migration runner (`server/src/database/migrate.ts`) az app startup-kor automatikusan lefuttatja az új migration-t (az `app.ts` 130-131. sorában hívódik a `runMigrations()`)
- A migration fájlok naming patternje: `NNN_description.sql` (3 számjegyű, szekvenciális)

---

## 2. lépés — Server Types

### Fájl: `server/src/types/index.ts` (MÓDOSÍTÁS)

**7. sor — Változtatás:**

```typescript
// RÉGI:
export type UserRole = 'admin' | 'manager' | 'user';

// ÚJ:
export type UserRole = 'superadmin' | 'admin' | 'manager' | 'user';
```

Semmi mást nem kell módosítani ebben a fájlban. A `User` interfész `role: UserRole` mezője automatikusan felismeri az új értéket.

---

## 3. lépés — Client Types

### Fájl: `client/src/types/index.ts` (MÓDOSÍTÁS)

**8. sor — Változtatás:**

```typescript
// RÉGI:
export type UserRole = 'admin' | 'manager' | 'user';

// ÚJ:
export type UserRole = 'superadmin' | 'admin' | 'manager' | 'user';
```

---

## 4. lépés — Auth Middleware (superadmin örökli az admin jogokat)

### Fájl: `server/src/middleware/auth.ts` (MÓDOSÍTÁS)

**101–115. sor — A `requireRole` függvény módosítása:**

```typescript
// RÉGI:
export function requireRole(...roles: string[]) {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Neautentificat.' });
            return;
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Nu ai permisiunea necesară.' });
            return;
        }

        next();
    };
}

// ÚJ:
export function requireRole(...roles: string[]) {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Neautentificat.' });
            return;
        }

        // superadmin inherits all admin rights automatically
        const effectiveRoles = roles.includes('admin')
            ? [...new Set([...roles, 'superadmin'])]
            : roles;

        if (!effectiveRoles.includes(req.user.role)) {
            res.status(403).json({ error: 'Nu ai permisiunea necesară.' });
            return;
        }

        next();
    };
}
```

**Miért működik ez:**
- Minden meglévő `requireRole('admin')` hívás automatikusan átengedi a `superadmin`-t is
- `requireRole('admin', 'manager')` szintén átengedi a `superadmin`-t (mert `admin` benne van)
- `requireRole('superadmin')` csak a superadmin-t engedi át (a Day View endpointhoz)
- `Set` használata a duplikátumok elkerülésére

**Érintett meglévő route-ok amik automatikusan működnek (nem kell módosítani):**
- `server/src/routes/admin.ts` → `requireRole('admin')` → superadmin is átmegy
- `server/src/routes/payments.ts` → `requireRole('admin')` → superadmin is átmegy
- `server/src/routes/reports.ts` → `requireRole('admin', 'manager')` → superadmin is átmegy
- `server/src/routes/emails.ts` → `requireRole('admin', 'manager')` → superadmin is átmegy

---

## 5. lépés — Day View API Endpoint

### Fájl: `server/src/routes/dayView.ts` (ÚJ)

Hozd létre ezt az új fájlt:

```typescript
import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

const router = Router();

// Protect all day-view routes: auth + superadmin only
router.use(authMiddleware, requireRole('superadmin'));

// ──────────────────────────────────────────────────
// GET /api/day-view?date=YYYY-MM-DD
// Returns all active users with their tasks for the given date
// ──────────────────────────────────────────────────
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const dateParam = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        res.status(400).json({ error: 'Formatul datei este invalid. Folosește YYYY-MM-DD.' });
        return;
    }

    // Get all active users
    const { rows: users } = await pool.query(`
        SELECT id, display_name, avatar_url, email
        FROM users
        WHERE is_active = true
        ORDER BY display_name
    `);

    // Get tasks for the given date (due on that date, not completed)
    // Include tasks that are: assigned to each user AND due_date = the given date AND status != 'terminat'
    const { rows: tasks } = await pool.query(`
        SELECT
            t.id,
            t.title,
            t.status,
            t.due_date,
            t.description,
            t.assigned_to,
            t.department_label,
            t.created_at
        FROM tasks t
        WHERE t.deleted_at IS NULL
          AND t.due_date::date = $1::date
          AND t.status != 'terminat'
          AND t.assigned_to IS NOT NULL
        ORDER BY
            CASE t.status
                WHEN 'blocat' THEN 1
                WHEN 'in_realizare' THEN 2
                WHEN 'de_rezolvat' THEN 3
            END,
            t.created_at
    `, [dateParam]);

    // Get subtasks for all those tasks in a single query
    const taskIds = tasks.map(t => t.id);
    let subtasksByTask: Record<string, any[]> = {};

    if (taskIds.length > 0) {
        const { rows: subtasks } = await pool.query(`
            SELECT id, task_id, title, is_completed, order_index
            FROM subtasks
            WHERE task_id = ANY($1)
            ORDER BY order_index
        `, [taskIds]);

        for (const st of subtasks) {
            if (!subtasksByTask[st.task_id]) subtasksByTask[st.task_id] = [];
            subtasksByTask[st.task_id].push({
                id: st.id,
                title: st.title,
                is_completed: st.is_completed,
            });
        }
    }

    // Group tasks by user
    const tasksByUser: Record<string, any[]> = {};
    for (const task of tasks) {
        if (!tasksByUser[task.assigned_to]) tasksByUser[task.assigned_to] = [];
        tasksByUser[task.assigned_to].push({
            id: task.id,
            title: task.title,
            status: task.status,
            due_date: task.due_date,
            description: task.description,
            department_label: task.department_label,
            subtasks: subtasksByTask[task.id] || [],
        });
    }

    // Build response
    const result = {
        date: dateParam,
        users: users.map(u => ({
            id: u.id,
            display_name: u.display_name,
            avatar_url: u.avatar_url,
            email: u.email,
            tasks: tasksByUser[u.id] || [],
        })),
    };

    res.json(result);
}));

// ──────────────────────────────────────────────────
// GET /api/day-view/pdf/:userId?date=YYYY-MM-DD
// Generates a branded PDF for a specific user's tasks
// ──────────────────────────────────────────────────
router.get('/pdf/:userId', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;
    const dateParam = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        res.status(400).json({ error: 'Formatul datei este invalid. Folosește YYYY-MM-DD.' });
        return;
    }

    // Get user info
    const { rows: [user] } = await pool.query(
        'SELECT id, display_name, email FROM users WHERE id = $1 AND is_active = true',
        [userId]
    );
    if (!user) {
        res.status(404).json({ error: 'Utilizatorul nu a fost găsit.' });
        return;
    }

    // Get tasks for this user on this date
    const { rows: tasks } = await pool.query(`
        SELECT
            t.id, t.title, t.status, t.due_date, t.description, t.department_label
        FROM tasks t
        WHERE t.deleted_at IS NULL
          AND t.due_date::date = $1::date
          AND t.status != 'terminat'
          AND t.assigned_to = $2
        ORDER BY
            CASE t.status
                WHEN 'blocat' THEN 1
                WHEN 'in_realizare' THEN 2
                WHEN 'de_rezolvat' THEN 3
            END,
            t.created_at
    `, [dateParam, userId]);

    // Get subtasks
    const taskIds = tasks.map(t => t.id);
    let subtasksByTask: Record<string, any[]> = {};
    if (taskIds.length > 0) {
        const { rows: subtasks } = await pool.query(`
            SELECT task_id, title, is_completed
            FROM subtasks
            WHERE task_id = ANY($1)
            ORDER BY order_index
        `, [taskIds]);
        for (const st of subtasks) {
            if (!subtasksByTask[st.task_id]) subtasksByTask[st.task_id] = [];
            subtasksByTask[st.task_id].push(st);
        }
    }

    // Status labels (Romanian)
    const STATUS_LABELS: Record<string, string> = {
        de_rezolvat: 'De rezolvat',
        in_realizare: 'În realizare',
        blocat: 'Blocat',
        terminat: 'Terminat',
    };

    // Department labels
    const DEPT_LABELS: Record<string, string> = {
        departament_1: 'Comunicare si HR',
        departament_2: 'Vanzari',
        departament_3: 'Financiar',
        departament_4: 'Productie',
        departament_5: 'Calitate',
        departament_6: 'Extindere',
        departament_7: 'Administrativ',
    };

    // Format the date for display
    const displayDate = new Date(dateParam + 'T00:00:00').toLocaleDateString('ro-RO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    // Generate PDF
    const safeName = user.display_name.replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${safeName}_tasks_${dateParam}.pdf`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    // ── Header with logo ──
    // Try to load the Visoro logo
    const logoPath = path.join(__dirname, '../../../client/public/visoro-logo.png');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 40, { width: 40 });
        doc.fontSize(18).font('Helvetica-Bold').text('Visoro Task Manager', 100, 48);
        doc.fontSize(9).font('Helvetica').fillColor('#888').text('Visoro Global SRL', 100, 68);
        doc.fillColor('#000');
        doc.moveDown(2);
    } else {
        doc.fontSize(18).font('Helvetica-Bold').text('Visoro Task Manager', { align: 'left' });
        doc.fontSize(9).font('Helvetica').fillColor('#888').text('Visoro Global SRL');
        doc.fillColor('#000');
        doc.moveDown(1);
    }

    // ── Title ──
    doc.fontSize(14).font('Helvetica-Bold').text(`Sarcini zilnice — ${user.display_name}`);
    doc.fontSize(10).font('Helvetica').fillColor('#555').text(displayDate);
    doc.fillColor('#000');
    doc.moveDown(0.5);

    // Horizontal line
    doc.strokeColor('#cccccc').lineWidth(0.5)
       .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.8);

    if (tasks.length === 0) {
        doc.fontSize(11).font('Helvetica').text('Nu există sarcini active pentru această zi.');
    } else {
        // ── Tasks table ──
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const subtasks = subtasksByTask[task.id] || [];

            // Page break if close to bottom
            if (doc.y > 700) doc.addPage();

            // Task number + title
            doc.fontSize(11).font('Helvetica-Bold')
               .text(`${i + 1}. ${task.title}`, { width: 495 });

            // Status + Department on same line
            const statusLabel = STATUS_LABELS[task.status] || task.status;
            const deptLabel = DEPT_LABELS[task.department_label] || task.department_label;
            doc.fontSize(9).font('Helvetica').fillColor('#555')
               .text(`Status: ${statusLabel}  |  Departament: ${deptLabel}  |  Termen: ${task.due_date}`);
            doc.fillColor('#000');

            // Description (truncated)
            if (task.description) {
                const desc = task.description.length > 200
                    ? task.description.substring(0, 200) + '...'
                    : task.description;
                doc.fontSize(9).font('Helvetica').fillColor('#333').text(desc, { width: 495 });
                doc.fillColor('#000');
            }

            // Subtasks
            if (subtasks.length > 0) {
                doc.moveDown(0.3);
                doc.fontSize(9).font('Helvetica-Bold').text(`Subtask-uri (${subtasks.filter(s => s.is_completed).length}/${subtasks.length}):`);
                for (const st of subtasks) {
                    const check = st.is_completed ? '☑' : '☐';
                    doc.fontSize(8).font('Helvetica').text(`  ${check} ${st.title}`);
                }
            }

            doc.moveDown(0.6);

            // Separator between tasks
            if (i < tasks.length - 1) {
                doc.strokeColor('#eeeeee').lineWidth(0.3)
                   .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
                doc.moveDown(0.4);
            }
        }
    }

    // ── Footer ──
    doc.moveDown(2);
    if (doc.y > 750) doc.addPage();
    doc.strokeColor('#cccccc').lineWidth(0.5)
       .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(8).font('Helvetica').fillColor('#999')
       .text(`Generat la: ${new Date().toLocaleString('ro-RO')}  —  Visoro Global SRL  —  ETM`, { align: 'center' });

    doc.end();
}));

export default router;
```

**Fontos részletek:**
- Az endpoint `authMiddleware` + `requireRole('superadmin')` védelmet kap — CSAK superadmin érheti el
- A `GET /api/day-view` query paramétere: `?date=YYYY-MM-DD` (default: ma)
- A PDF endpoint: `GET /api/day-view/pdf/:userId?date=YYYY-MM-DD`
- A PDF a `pdfkit` könyvtárat használja (konzisztens a meglévő `reports.ts`-sel)
- A logó a `client/public/visoro-logo.png`-ből töltődik (graceful fallback ha nincs)
- A `asyncHandler` wrapper az `errorHandler.ts`-ből jön (try-catch nélkül kezeli a hibákat)

---

## 6. lépés — Route regisztráció

### Fájl: `server/src/app.ts` (MÓDOSÍTÁS)

**2 változtatás kell:**

### 6a. Import hozzáadása (a 28. sor után):

```typescript
// RÉGI (28. sor):
import webhookRoutes from './routes/webhooks';

// ÚJ (28-29. sor):
import webhookRoutes from './routes/webhooks';
import dayViewRoutes from './routes/dayView';
```

### 6b. Route regisztrálása (a 79. sor után, a webhookRoutes után):

```typescript
// RÉGI (79. sor):
app.use('/api/webhooks', webhookRoutes);

// ÚJ (79-80. sor):
app.use('/api/webhooks', webhookRoutes);
app.use('/api/day-view', dayViewRoutes);
```

---

## 7. lépés — ProtectedRoute frissítése (kliens oldali guard)

### Fájl: `client/src/components/auth/ProtectedRoute.tsx` (MÓDOSÍTÁS)

A superadmin-nak is át kell mennie azokon a route-okon, amelyek `allowedRoles={['admin']}` védelmet kapnak.

```typescript
// RÉGI:
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface Props {
    allowedRoles: string[];
    children: React.ReactNode;
}

export default function ProtectedRoute({ allowedRoles, children }: Props) {
    const { user } = useAuth();

    if (!user || !allowedRoles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

// ÚJ:
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface Props {
    allowedRoles: string[];
    children: React.ReactNode;
}

export default function ProtectedRoute({ allowedRoles, children }: Props) {
    const { user } = useAuth();

    // superadmin inherits admin rights on client side too
    const effectiveRoles = allowedRoles.includes('admin')
        ? [...new Set([...allowedRoles, 'superadmin'])]
        : allowedRoles;

    if (!user || !effectiveRoles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
```

**Miért kell:** A meglévő route-ok (`/admin`, `/financiar`) `allowedRoles={['admin']}`-t használnak. Enélkül a superadmin nem jutna be ezekre az oldalakra a kliens oldalon (a szerver oldal ugyan átengedné, de a React router már a kliens oldalon redirectelne).

---

## 8. lépés — Layout.tsx (navigáció frissítése)

### Fájl: `client/src/components/layout/Layout.tsx` (MÓDOSÍTÁS)

### 8a. Új ikon import (6. sor):

```typescript
// RÉGI (6. sor):
import {
    LayoutDashboard, ListTodo, LogOut, Moon, Sun,
    ChevronLeft, ChevronRight, Bell, Shield, Mail, LayoutTemplate, Banknote, Activity
} from 'lucide-react';

// ÚJ (6. sor):
import {
    LayoutDashboard, ListTodo, LogOut, Moon, Sun,
    ChevronLeft, ChevronRight, Bell, Shield, Mail, LayoutTemplate, Banknote, Activity, CalendarClock
} from 'lucide-react';
```

### 8b. navItems tömb frissítése (31–39. sor):

```typescript
// RÉGI:
const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/tasks', icon: ListTodo, label: 'Sarcini' },
    { to: '/activitate', icon: Activity, label: 'Activitate' },
    { to: '/templates', icon: LayoutTemplate, label: 'Șabloane' },
    ...(user?.role === 'admin' ? [{ to: '/financiar', icon: Banknote, label: 'Financiar' }] : []),
    ...(user?.role === 'admin' ? [{ to: '/admin', icon: Shield, label: 'Admin' }] : []),
    ...((user?.role === 'admin' || user?.role === 'manager') ? [{ to: '/emails', icon: Mail, label: 'Email Logs' }] : []),
];

// ÚJ:
const isSuperadmin = user?.role === 'superadmin';
const isAdmin = user?.role === 'admin' || isSuperadmin;
const isManagerOrAbove = isAdmin || user?.role === 'manager';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/tasks', icon: ListTodo, label: 'Sarcini' },
    { to: '/activitate', icon: Activity, label: 'Activitate' },
    { to: '/templates', icon: LayoutTemplate, label: 'Șabloane' },
    ...(isSuperadmin ? [{ to: '/day-view', icon: CalendarClock, label: 'Napi nézet' }] : []),
    ...(isAdmin ? [{ to: '/financiar', icon: Banknote, label: 'Financiar' }] : []),
    ...(isAdmin ? [{ to: '/admin', icon: Shield, label: 'Admin' }] : []),
    ...(isManagerOrAbove ? [{ to: '/emails', icon: Mail, label: 'Email Logs' }] : []),
];
```

**Miért:**
- `isSuperadmin` — csak a superadmin látja a "Napi nézet" menüpontot
- `isAdmin` — az admin ÉS a superadmin is látja a Financiar + Admin menüket
- `isManagerOrAbove` — manager, admin, superadmin mind látja az Email Logs-t

---

## 9. lépés — App.tsx (route hozzáadása)

### Fájl: `client/src/App.tsx` (MÓDOSÍTÁS)

### 9a. DayViewPage import hozzáadása (a 14. sor után):

```typescript
// RÉGI (14. sor):
import ActivityFeedPage from './components/activity/ActivityFeedPage';

// ÚJ (14-15. sor):
import ActivityFeedPage from './components/activity/ActivityFeedPage';
import DayViewPage from './components/dayview/DayViewPage';
```

### 9b. Új route hozzáadása (az 57. sor után, az emails route után):

```typescript
// RÉGI (55-57. sor):
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><ErrorBoundary><AdminPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/financiar" element={<ProtectedRoute allowedRoles={['admin']}><ErrorBoundary><PaymentsPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/emails" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><ErrorBoundary><EmailLogsPage /></ErrorBoundary></ProtectedRoute>} />

// ÚJ (55-58. sor):
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><ErrorBoundary><AdminPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/financiar" element={<ProtectedRoute allowedRoles={['admin']}><ErrorBoundary><PaymentsPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/emails" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><ErrorBoundary><EmailLogsPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/day-view" element={<ProtectedRoute allowedRoles={['superadmin']}><ErrorBoundary><DayViewPage /></ErrorBoundary></ProtectedRoute>} />
```

**Megjegyzés:** A `ProtectedRoute` itt `allowedRoles={['superadmin']}`-ot kap — csak a superadmin érheti el. Ez nem szorul a 7. lépésben bevezetett admin öröklésre, mert közvetlenül `superadmin` van megadva.

---

## 10. lépés — API service bővítése

### Fájl: `client/src/services/api.ts` (MÓDOSÍTÁS)

A fájl végéhez (a 209. sor elé, az `export { api }` sor elé) add hozzá:

```typescript
// Day View (superadmin)
export const dayViewApi = {
    get: (date: string) => api.get(`/day-view`, { params: { date } }).then(r => r.data),
    getPdfUrl: (userId: string, date: string) => `/api/day-view/pdf/${userId}?date=${date}`,
};
```

**Megjegyzés:** A `getPdfUrl` nem axios hívás, hanem egy URL stringet ad vissza, amit a böngésző `window.open()`-nel vagy `<a href>` linkkel hív meg. A PDF endpoint közvetlenül streameli a választ, tehát a böngésző automatikusan letölti.

A PDF letöltésnél az auth tokent az URL-ben nem tudjuk átadni (security risk), ezért a PDF letöltéshez egy speciális megoldás kell. Add hozzá ezt is:

```typescript
// Day View (superadmin)
export const dayViewApi = {
    get: (date: string) => api.get(`/day-view`, { params: { date } }).then(r => r.data),
    downloadPdf: (userId: string, date: string) =>
        api.get(`/day-view/pdf/${userId}`, {
            params: { date },
            responseType: 'blob',
        }).then(r => {
            const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = r.headers['content-disposition']?.split('filename=')[1] || `tasks_${date}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        }),
};
```

**Fontos:** A `responseType: 'blob'` biztosítja, hogy az axios ne próbálja JSON-ként parse-olni a PDF-et. Az auth token az axios interceptor által automatikusan hozzáadódik a requesthez.

---

## 11. lépés — DayViewPage komponens

### Fájl: `client/src/components/dayview/DayViewPage.tsx` (ÚJ)

Hozd létre a `client/src/components/dayview/` könyvtárat és benne a `DayViewPage.tsx` fájlt:

```tsx
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { dayViewApi } from '../../services/api';
import { STATUSES } from '../../types';
import {
    CalendarClock, ChevronDown, ChevronRight, FileDown,
    GripVertical, CheckCircle2, Circle, Loader2, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface DayViewSubtask {
    id: string;
    title: string;
    is_completed: boolean;
}

interface DayViewTask {
    id: string;
    title: string;
    status: string;
    due_date: string;
    description: string | null;
    department_label: string;
    subtasks: DayViewSubtask[];
}

interface DayViewUser {
    id: string;
    display_name: string;
    avatar_url: string | null;
    email: string;
    tasks: DayViewTask[];
}

interface DayViewData {
    date: string;
    users: DayViewUser[];
}

const STORAGE_KEY = 'day-view-user-order';

function getStoredOrder(): string[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function storeOrder(ids: string[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

function reorderUsers(users: DayViewUser[]): DayViewUser[] {
    const storedOrder = getStoredOrder();
    if (storedOrder.length === 0) return users;

    const userMap = new Map(users.map(u => [u.id, u]));
    const ordered: DayViewUser[] = [];

    // First: users in stored order
    for (const id of storedOrder) {
        const user = userMap.get(id);
        if (user) {
            ordered.push(user);
            userMap.delete(id);
        }
    }

    // Then: remaining users (new users not yet in stored order)
    for (const user of userMap.values()) {
        ordered.push(user);
    }

    return ordered;
}

export default function DayViewPage() {
    const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
    const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
    const [orderedUsers, setOrderedUsers] = useState<DayViewUser[]>([]);
    const [pdfLoading, setPdfLoading] = useState<string | null>(null);

    const { data, isLoading, error } = useQuery<DayViewData>({
        queryKey: ['day-view', selectedDate],
        queryFn: () => dayViewApi.get(selectedDate),
        staleTime: 30_000,
    });

    // Apply stored order when data arrives
    useEffect(() => {
        if (data?.users) {
            const ordered = reorderUsers(data.users);
            setOrderedUsers(ordered);
            // Auto-expand users who have tasks
            const withTasks = new Set(ordered.filter(u => u.tasks.length > 0).map(u => u.id));
            setExpandedUsers(withTasks);
        }
    }, [data]);

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const items = [...orderedUsers];
        const [moved] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, moved);
        setOrderedUsers(items);
        storeOrder(items.map(u => u.id));
    };

    const toggleUser = (userId: string) => {
        setExpandedUsers(prev => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const handleDownloadPdf = async (userId: string) => {
        setPdfLoading(userId);
        try {
            await dayViewApi.downloadPdf(userId, selectedDate);
        } catch (err) {
            console.error('PDF download failed:', err);
        } finally {
            setPdfLoading(null);
        }
    };

    const displayDate = format(new Date(selectedDate + 'T00:00:00'), 'yyyy. MMMM d., EEEE', { locale: ro });

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg">
                        <CalendarClock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Napi nézet</h1>
                        <p className="text-sm text-navy-400 dark:text-navy-400 capitalize">{displayDate}</p>
                    </div>
                </div>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-navy-700/50 bg-navy-900/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
            </div>

            {/* Loading state */}
            {isLoading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="text-center py-20">
                    <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                    <p className="text-red-400">Hiba történt az adatok betöltésekor.</p>
                </div>
            )}

            {/* User sections with drag-to-reorder */}
            {!isLoading && !error && orderedUsers.length > 0 && (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="day-view-users">
                        {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                                {orderedUsers.map((user, index) => (
                                    <Draggable key={user.id} draggableId={user.id} index={index}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={`rounded-xl border transition-all ${
                                                    snapshot.isDragging
                                                        ? 'border-blue-500/50 shadow-lg shadow-blue-500/10'
                                                        : 'border-navy-700/50'
                                                } bg-navy-900/50`}
                                            >
                                                {/* User header */}
                                                <div className="flex items-center gap-3 px-4 py-3">
                                                    {/* Drag handle */}
                                                    <div {...provided.dragHandleProps} className="cursor-grab text-navy-500 hover:text-navy-300">
                                                        <GripVertical className="w-4 h-4" />
                                                    </div>

                                                    {/* Avatar */}
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                        {user.avatar_url
                                                            ? <img src={user.avatar_url} alt={user.display_name} className="w-8 h-8 rounded-full object-cover" />
                                                            : user.display_name.charAt(0).toUpperCase()
                                                        }
                                                    </div>

                                                    {/* Name + task count */}
                                                    <button
                                                        onClick={() => toggleUser(user.id)}
                                                        className="flex-1 flex items-center gap-2 text-left"
                                                    >
                                                        <span className="font-medium text-sm">{user.display_name}</span>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                            user.tasks.length > 0
                                                                ? 'bg-blue-500/20 text-blue-400'
                                                                : 'bg-navy-800 text-navy-400'
                                                        }`}>
                                                            {user.tasks.length} {user.tasks.length === 1 ? 'sarcină' : 'sarcini'}
                                                        </span>
                                                        {expandedUsers.has(user.id)
                                                            ? <ChevronDown className="w-4 h-4 text-navy-400" />
                                                            : <ChevronRight className="w-4 h-4 text-navy-400" />
                                                        }
                                                    </button>

                                                    {/* PDF export button */}
                                                    {user.tasks.length > 0 && (
                                                        <button
                                                            onClick={() => handleDownloadPdf(user.id)}
                                                            disabled={pdfLoading === user.id}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-navy-800 hover:bg-navy-700 text-navy-300 hover:text-white transition-all disabled:opacity-50"
                                                            title="Export PDF"
                                                        >
                                                            {pdfLoading === user.id
                                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                : <FileDown className="w-3.5 h-3.5" />
                                                            }
                                                            PDF
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Expanded task list */}
                                                {expandedUsers.has(user.id) && user.tasks.length > 0 && (
                                                    <div className="border-t border-navy-700/30 px-4 py-3 space-y-2.5">
                                                        {user.tasks.map((task) => (
                                                            <TaskRow key={task.id} task={task} />
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Expanded but no tasks */}
                                                {expandedUsers.has(user.id) && user.tasks.length === 0 && (
                                                    <div className="border-t border-navy-700/30 px-4 py-4">
                                                        <p className="text-sm text-navy-500 text-center">
                                                            Nu are sarcini active pentru această zi.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            )}

            {/* Empty state */}
            {!isLoading && !error && orderedUsers.length === 0 && (
                <div className="text-center py-20">
                    <CalendarClock className="w-12 h-12 text-navy-600 mx-auto mb-3" />
                    <p className="text-navy-400">Nu există utilizatori activi.</p>
                </div>
            )}
        </div>
    );
}

// ─── Task Row Component ──────────────────────
function TaskRow({ task }: { task: DayViewTask }) {
    const statusConfig = STATUSES[task.status as keyof typeof STATUSES];
    const completedSubtasks = task.subtasks.filter(s => s.is_completed).length;
    const totalSubtasks = task.subtasks.length;

    return (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-navy-800/40 hover:bg-navy-800/60 transition-colors">
            {/* Status indicator */}
            <div
                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                style={{ backgroundColor: statusConfig?.color || '#666' }}
                title={statusConfig?.label || task.status}
            />

            <div className="flex-1 min-w-0">
                {/* Title */}
                <p className="text-sm font-medium leading-snug">{task.title}</p>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-2 mt-1">
                    {/* Status badge */}
                    <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{
                            backgroundColor: statusConfig?.bg || 'rgba(100,100,100,0.2)',
                            color: statusConfig?.color || '#999',
                            border: `1px solid ${statusConfig?.border || 'transparent'}`,
                        }}
                    >
                        {statusConfig?.label || task.status}
                    </span>

                    {/* Subtask count */}
                    {totalSubtasks > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-navy-400">
                            {completedSubtasks === totalSubtasks
                                ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                : <Circle className="w-3 h-3" />
                            }
                            {completedSubtasks}/{totalSubtasks} subtask
                        </span>
                    )}
                </div>

                {/* Description preview */}
                {task.description && (
                    <p className="text-xs text-navy-400 mt-1 line-clamp-2">
                        {task.description}
                    </p>
                )}
            </div>
        </div>
    );
}
```

**Fontos részletek:**
- **Date picker:** `<input type="date">` — natív dátumválasztó, egyszerű és cross-browser
- **Drag & drop:** `@hello-pangea/dnd` — ugyanaz a lib amit a Kanban view és a checklist is használ
- **User sorrend:** `localStorage`-ban tárolódik (`day-view-user-order` kulcs)
- **Auto-expand:** Az oldal betöltésekor automatikusan kinyílnak azok a felhasználók, akiknek van feladatuk
- **PDF letöltés:** Axios blob kérés az auth tokennel
- **Responsive:** `max-w-5xl mx-auto` + flexbox + `sm:` breakpoints
- **Dark mode:** A meglévő `navy-*` osztályokat használja (konzisztens a többi oldallal)
- **React Query:** `['day-view', selectedDate]` query key — dátumváltáskor automatikusan újratölt

---

## Verifikációs terv

### 1. Migration ellenőrzése
```sql
-- A migration futása után:
SELECT email, role FROM users WHERE email = 'ledenyi.robert@visoro-global.ro';
-- Eredmény: role = 'superadmin'
```

### 2. Superadmin bejelentkezés
- Jelentkezz be mint Robert Ledenyi
- Az oldalsávban meg kell jelennie: **Dashboard, Sarcini, Activitate, Șabloane, Napi nézet, Financiar, Admin, Email Logs**
- A "Napi nézet" elem a `CalendarClock` ikonnal jelenik meg

### 3. Day View oldal
- Kattints a "Napi nézet" menüpontra
- Az oldalon megjelenik az összes aktív felhasználó, személyenként csoportosítva
- A mai dátum feladatai látszanak (status ≠ terminat)
- A felhasználók neve mellett látszik a feladatszám badge

### 4. Drag & drop sorrend
- Húzd át a felhasználókat
- Frissítsd az oldalt (F5)
- A sorrend megmarad (localStorage)

### 5. PDF export
- Kattints a "PDF" gombra egy felhasználónál
- Egy PDF fájl letöltődik: `{NÉV}_tasks_{DÁTUM}.pdf`
- A PDF tartalmazza: Visoro logó, név, dátum, feladattáblázat, subtaskok, "Visoro Global SRL" footer

### 6. Jogosultság ellenőrzés
- Jelentkezz be mint normál admin (nem superadmin)
- A "Napi nézet" menüpont NEM jelenik meg
- A `/day-view` URL direktben megnyitva → redirect a Dashboard-ra
- A Financiar és Admin oldalak továbbra is működnek admin-nak

### 7. API védelem
- `GET /api/day-view` egy admin tokennel → **403 Forbidden**
- `GET /api/day-view` superadmin tokennel → **200 OK** + JSON adat
- `GET /api/day-view/pdf/:id` admin tokennel → **403 Forbidden**

---

## Összefoglalás — Fájlok sorrendje

| Sorrend | Fájl | Típus |
|---------|------|-------|
| 1 | `server/src/database/migrations/031_add_superadmin_role.sql` | ÚJ |
| 2 | `server/src/types/index.ts` (7. sor) | MÓDOSÍTÁS |
| 3 | `client/src/types/index.ts` (8. sor) | MÓDOSÍTÁS |
| 4 | `server/src/middleware/auth.ts` (101-115. sor) | MÓDOSÍTÁS |
| 5 | `server/src/routes/dayView.ts` | ÚJ |
| 6 | `server/src/app.ts` (28+79. sor) | MÓDOSÍTÁS |
| 7 | `client/src/components/auth/ProtectedRoute.tsx` | MÓDOSÍTÁS |
| 8 | `client/src/components/layout/Layout.tsx` (6+31-39. sor) | MÓDOSÍTÁS |
| 9 | `client/src/App.tsx` (14+57. sor) | MÓDOSÍTÁS |
| 10 | `client/src/services/api.ts` (209. sor elé) | MÓDOSÍTÁS |
| 11 | `client/src/components/dayview/DayViewPage.tsx` | ÚJ |
