# ETM Bugfix Prompt — 6 hiba javítása

Az alábbi 6 hibát kell javítani. Mindegyikhez megadom a fájlt, a problémát, és a pontos javítást.

---

## BUG 1 — Task törlés: nem tűnik el a task (nincs hibaüzenet)

**Tünet:** A user törli a saját taskját, nem kap hibaüzenetet, de a task nem tűnik el a listából.

**Gyökérok:** A `useTaskDetail.ts`-ben a `deleteTask` mutációnak NINCS `onSettled` callbackje, ami frissítené a cache-t. A `TaskDrawer` `onSuccess`-je hívja az `onUpdate()`-et (ami `loadTasks()`), de ez nem mindig elegendő.

**Javítás — 2 fájl:**

### 1a) `client/src/hooks/useTaskDetail.ts` — L229-231

**RÉGI:**
```typescript
const deleteTask = useMutation({
    mutationFn: () => tasksApi.delete(taskId),
});
```

**ÚJ:**
```typescript
const deleteTask = useMutation({
    mutationFn: () => tasksApi.delete(taskId),
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
});
```

Ehhez szükséges a `queryClient` import a fájl tetején (ha nincs már):
```typescript
import { useQueryClient } from '@tanstack/react-query';
```
és a hook belsejében:
```typescript
const queryClient = useQueryClient();
```

### 1b) `client/src/components/tasks/TaskDrawer.tsx` — L147-153

**RÉGI:**
```typescript
async function handleDeleteTask() {
    setShowDeleteConfirm(false);
    td.deleteTask.mutate(undefined, {
        onSuccess: () => { showToast('Task șters'); onClose(); onUpdate(); },
        onError: (err: any) => showToast(err.response?.data?.error || 'Eroare', 'error'),
    });
}
```

**ÚJ:**
```typescript
async function handleDeleteTask() {
    setShowDeleteConfirm(false);
    td.deleteTask.mutate(undefined, {
        onSuccess: () => {
            showToast('Task șters');
            onClose();
            // kis delay, hogy a backend UPDATE biztosan véglegesedjen
            setTimeout(() => onUpdate(), 300);
        },
        onError: (err: any) => showToast(err.response?.data?.error || 'Eroare', 'error'),
    });
}
```

### 1c) Debug log a backendbe (ideiglenesen)

`server/src/services/taskService.ts` — `softDeleteTask` függvény elejére (L280 után):

```typescript
console.log('[DELETE DEBUG]', {
    taskId: id,
    userId,
    userRole,
    created_by: rows[0]?.created_by,
    match: rows[0]?.created_by === userId
});
```

**Ha a logban `match: false` jelenik meg**, az azt jelenti, hogy a `created_by` UUID nem egyezik a bejelentkezett user UUID-jével — akkor az a probléma, hogy a user ID valahol eltér. Ebben az esetben szólj nekem.

---

## BUG 2 — Checklist hozzáadás hiba (user role-nál)

**Tünet:** Maria (user role) nem tud checklist itemet hozzáadni, hibát dob.

**A backend kód jónak tűnik** (nincs role-check a checklist POST-on). A pontos ok kiderítéséhez:

### Diagnosztika lépések:
1. Jelentkezz be Maria Vaszi-ként
2. Nyisd meg a böngésző DevTools-t (F12) → **Network** tab
3. Próbáld hozzáadni a checklist itemet
4. Nézd meg a POST kérés **response status kódját** és **response body**-ját
5. Nézd meg a **szerver konzol logot** (a terminálban ahol a backend fut)

### Lehetséges ok és javítás:

Ha a hiba **500** status kóddal jön, és az üzenet foreign key constraint-ot említ:

**Fájl:** `server/src/routes/taskChecklist.ts` — a POST handler-be adj hozzá egy task létezés-ellenőrzést a checklist item INSERT elé:

```typescript
// Ellenőrizd, hogy a task létezik és nem törölt
const { rows: taskCheck } = await pool.query(
    'SELECT id FROM tasks WHERE id = $1 AND deleted_at IS NULL',
    [taskId]
);
if (taskCheck.length === 0) {
    res.status(404).json({ error: 'A task nem létezik vagy törölve lett.' });
    return;
}
```

**Ha más a hiba:** Küldd el a pontos hibaüzenetet (response body + szerver log), és megmondom a javítást.

---

## BUG 3 — „În atenție" (Active Alerts) widget nem látszik a user dashboard-ján

**Fájl:** `server/src/routes/dashboard.ts`
**Probléma:** A `DEFAULT_LAYOUTS` objektumban a `user` role-nál az `active_alerts` widget `visible: false`.

**Javítás:**

Keresd meg a `DEFAULT_LAYOUTS` objektumot (kb. L259-270), azon belül a `user` tömböt. Cseréld le:

**RÉGI:**
```typescript
{ widget_id: 'active_alerts', visible: false, order: 7 },
```

**ÚJ:**
```typescript
{ widget_id: 'active_alerts', visible: true, order: 3, size: 'full' },
```

**Fontos:** Ha a user-ek már módosították a layout-jukat (van mentett rekord a `dashboard_layouts` táblában), azokat NEM fogja felülírni a default. Csak az új userekre, vagy azokra akiknek nincs mentett layout-juk, hat.

---

## BUG 4 — Dashboard minden user adatát mutatja (nem szűr role szerint)

**Fájl:** `server/src/routes/dashboard.ts`
**Probléma:** A `/stats`, `/charts`, `/active-alerts` és `/bottlenecks` endpoint-ek SEMMILYEN user-role szűrést nem végeznek. Minden user (beleértve a sima `user` role-t) az összes task statisztikáját látja.

**Javítás:**

### 4a) Helper függvény a fájl tetejére (az importok után):

```typescript
/**
 * Generates a SQL WHERE clause fragment that limits visibility for 'user' role.
 * Admin and manager see everything; regular users see only:
 * - Tasks they created
 * - Tasks assigned to them
 * - Tasks with subtasks assigned to them
 */
function userScopeFilter(
    user: { id: string; role: string },
    tableAlias: string = 't',
    startParamIndex: number = 1
): { clause: string; values: any[]; nextParamIndex: number } {
    if (user.role === 'admin' || user.role === 'manager') {
        return { clause: '', values: [], nextParamIndex: startParamIndex };
    }
    const p = startParamIndex;
    return {
        clause: `AND (${tableAlias}.created_by = $${p} OR ${tableAlias}.assigned_to = $${p} OR EXISTS (SELECT 1 FROM subtasks st WHERE st.task_id = ${tableAlias}.id AND st.assigned_to = $${p}))`,
        values: [user.id],
        nextParamIndex: p + 1,
    };
}
```

### 4b) Alkalmazd az összes endpoint-en:

Minden endpoint-ben (ahol `FROM tasks t` van a query-ben), adj hozzá a `userScopeFilter` hívást:

```typescript
const scope = userScopeFilter(req.user!, 't', /* next available param index */);
```

Pl. a `/stats` endpoint-ben a query-kbe:
```sql
SELECT COUNT(*) FROM tasks t WHERE status IN ('de_rezolvat', 'in_realizare') AND deleted_at IS NULL ${scope.clause}
```
És a query paraméterekhez fűzd hozzá: `[...scope.values]`

**Ezt alkalmazd az összes dashboard endpoint-re:**
- `/stats` — összes COUNT query
- `/charts` — chart data query + urgent_tasks query
- `/active-alerts` — alerts query
- `/bottlenecks` — bottleneck query

---

## BUG 5 — Subtask dátum nem működik (nem menti el)

**Tünet:** A subtask-okhoz beállított dátum nem mentődik el / nem jelenik meg.

**Gyökérok:** Lehetséges, hogy a PostgreSQL `DATE` oszlop a `pg` driver-en keresztül JavaScript Date objektumként érkezik, ami JSON-ná szerializálva `"2026-03-25T00:00:00.000Z"` formátumot kap. Az `<input type="date">` viszont `YYYY-MM-DD` formátumot vár.

**Javítás — 2 lehetőség (válaszd az egyiket):**

### 5a) Frontend fix — formázd a dátumot (EGYSZERŰBB)

**Fájl:** `client/src/components/tasks/tabs/SubtasksTab.tsx` — L160-166

**RÉGI:**
```tsx
<input
    type="date"
    value={subtask.due_date || ''}
    onChange={e => changeDueDate(subtask.id, e.target.value || null)}
```

**ÚJ:**
```tsx
<input
    type="date"
    value={subtask.due_date ? subtask.due_date.slice(0, 10) : ''}
    onChange={e => changeDueDate(subtask.id, e.target.value || null)}
```

A `.slice(0, 10)` kivágja a `YYYY-MM-DD` részt, akár `"2026-03-25"` akár `"2026-03-25T00:00:00.000Z"` formátumban jön.

### 5b) Backend fix — biztosítsd, hogy DATE formátumban menjen (OPCIONÁLIS)

**Fájl:** `server/src/routes/taskSubtasks.ts` — a PUT handler-ben (L239-242) és a POST handler-ben is, a `due_date` értéket formázd:

```typescript
if (due_date !== undefined) {
    updates.push(`due_date = $${paramIndex++}`);
    // Biztosítsd, hogy YYYY-MM-DD formátumban menjen
    values.push(due_date ? new Date(due_date).toISOString().split('T')[0] : null);
}
```

### 5c) Globális fix — pg driver DATE parser (LEGJOBB)

**Fájl:** `server/src/config/database.ts` — add hozzá a fájl tetejére:

```typescript
import pg from 'pg';
// Prevent pg from converting DATE to JavaScript Date object
// Return as plain YYYY-MM-DD string instead
pg.types.setTypeParser(1082, (val: string) => val); // 1082 = DATE OID
```

Ez biztosítja, hogy az összes DATE oszlop `YYYY-MM-DD` stringként jön vissza, nem Date objektumként.

---

## BUG 6 — Task list TEAM-BASED VIEW filter hiányos (assigned_to hiányzik)

**Fájl:** `server/src/routes/tasks.ts` — L119-127
**Probléma:** A user role filter csak `created_by` és subtask `assigned_to`-t nézi, de **hiányzik a fő task `assigned_to`** feltétel.

**Javítás:**

**RÉGI (L121-124):**
```typescript
conditions.push(`(
    t.created_by = $${paramIndex} OR
    EXISTS (SELECT 1 FROM subtasks st WHERE st.task_id = t.id AND st.assigned_to = $${paramIndex})
)`);
```

**ÚJ:**
```typescript
conditions.push(`(
    t.created_by = $${paramIndex} OR
    t.assigned_to = $${paramIndex} OR
    EXISTS (SELECT 1 FROM subtasks st WHERE st.task_id = t.id AND st.assigned_to = $${paramIndex})
)`);
```

---

## Összefoglalás — prioritás szerint

| # | Bug | Súlyosság | Fájlok |
|---|-----|-----------|--------|
| 1 | Task törlés nem frissíti a UI-t | HIGH | useTaskDetail.ts, TaskDrawer.tsx |
| 2 | Checklist hiba (diagnosztika kell) | HIGH | taskChecklist.ts |
| 3 | Active Alerts nem látszik user-nek | MEDIUM | dashboard.ts |
| 4 | Dashboard nem szűr user role-ra | HIGH | dashboard.ts (4 endpoint) |
| 5 | Subtask dátum nem jelenik meg | MEDIUM | SubtasksTab.tsx + database.ts |
| 6 | Task list filter hiányzó assigned_to | MEDIUM | tasks.ts |

**Tesztelés:** Minden javítás után jelentkezz be **Maria Vaszi** user-ként (user role) és ellenőrizd, hogy:
1. Task törlése után a task eltűnik a listából
2. Checklist itemet tud hozzáadni
3. Az „În atenție" widget látszik a dashboardon
4. A dashboard csak Maria saját taskjait/statisztikáit mutatja
5. A subtask dátum beállítható és megjelenik
6. Ha egy taskot közvetlenül Mariához rendelnek (nem subtask), akkor megjelenik a task listában
