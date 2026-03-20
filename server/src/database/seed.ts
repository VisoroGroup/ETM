import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../..', '.env') });

async function seed() {
    const client = await pool.connect();

    try {
        console.log('🌱 Seeding database...');

        // Create demo users
        const users = [
            {
                id: uuidv4(),
                microsoft_id: 'dev-user-001',
                email: 'admin@visoro.ro',
                display_name: 'Admin Visoro',
                departments: ['departament_1'],
                role: 'admin'
            },
            {
                id: uuidv4(),
                microsoft_id: 'dev-user-002',
                email: 'maria.popescu@visoro.ro',
                display_name: 'Maria Popescu',
                departments: ['departament_2'],
                role: 'manager'
            },
            {
                id: uuidv4(),
                microsoft_id: 'dev-user-003',
                email: 'ion.ionescu@visoro.ro',
                display_name: 'Ion Ionescu',
                departments: ['departament_3'],
                role: 'user'
            },
            {
                id: uuidv4(),
                microsoft_id: 'dev-user-004',
                email: 'ana.dumitrescu@visoro.ro',
                display_name: 'Ana Dumitrescu',
                departments: ['departament_1'],
                role: 'user'
            },
            {
                id: uuidv4(),
                microsoft_id: 'dev-user-005',
                email: 'alex.stan@visoro.ro',
                display_name: 'Alexandru Stan',
                departments: ['departament_5'],
                role: 'user'
            }
        ];

        for (const user of users) {
            await client.query(
                `INSERT INTO users (id, microsoft_id, email, display_name, departments, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (microsoft_id) DO NOTHING`,
                [user.id, user.microsoft_id, user.email, user.display_name, user.departments, user.role]
            );
        }
        console.log(`✅ Created ${users.length} users`);

        // Create demo tasks
        const today = new Date();
        const tasks = [
            {
                title: 'Pregătirea raportului financiar trimestrial',
                description: 'Raportul Q1 trebuie finalizat și trimis către management. Include toate departamentele.',
                status: 'in_realizare',
                due_date: new Date(today.getTime() + 2 * 86400000).toISOString().split('T')[0],
                created_by: users[0].id,
                department_label: 'departament_1'
            },
            {
                title: 'Actualizare politici interne de securitate',
                description: 'Revizuirea și actualizarea documentelor de securitate IT conform noilor reglementări.',
                status: 'de_rezolvat',
                due_date: new Date(today.getTime() - 1 * 86400000).toISOString().split('T')[0],
                created_by: users[1].id,
                department_label: 'departament_4'
            },
            {
                title: 'Organizare sesiune de training echipă',
                description: 'Sesiune de training pentru noile proceduri de lucru. Participă toți membrii departamentului.',
                status: 'de_rezolvat',
                due_date: new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0],
                created_by: users[2].id,
                department_label: 'departament_2'
            },
            {
                title: 'Audit contracte furnizori',
                description: 'Verificarea tuturor contractelor active cu furnizorii și renegociere unde este cazul.',
                status: 'blocat',
                due_date: new Date(today.getTime() + 5 * 86400000).toISOString().split('T')[0],
                created_by: users[0].id,
                department_label: 'departament_3'
            },
            {
                title: 'Implementare sistem nou de ticketing',
                description: 'Migrarea de la sistemul vechi la noul sistem de ticketing pentru suportul clienților.',
                status: 'in_realizare',
                due_date: new Date(today.getTime() + 14 * 86400000).toISOString().split('T')[0],
                created_by: users[3].id,
                department_label: 'departament_5'
            },
            {
                title: 'Revizuire buget departament marketing',
                description: 'Analiza cheltuielilor și ajustarea bugetului pentru trimestrul următor.',
                status: 'de_rezolvat',
                due_date: today.toISOString().split('T')[0],
                created_by: users[1].id,
                department_label: 'departament_6'
            },
            {
                title: 'Backup și migrare date server vechi',
                description: 'Transfer complet al datelor de pe serverul legacy pe noua infrastructură cloud.',
                status: 'terminat',
                due_date: new Date(today.getTime() - 3 * 86400000).toISOString().split('T')[0],
                created_by: users[4].id,
                department_label: 'departament_7'
            },
            {
                title: 'Pregătire documentație proiect nou',
                description: 'Crearea documentației tehnice și a specificațiilor pentru noul proiect de dezvoltare.',
                status: 'de_rezolvat',
                due_date: new Date(today.getTime() + 10 * 86400000).toISOString().split('T')[0],
                created_by: users[2].id,
                department_label: 'departament_1'
            }
        ];

        const taskIds: string[] = [];
        for (const task of tasks) {
            const taskId = uuidv4();
            taskIds.push(taskId);
            await client.query(
                `INSERT INTO tasks (id, title, description, status, due_date, created_by, department_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [taskId, task.title, task.description, task.status, task.due_date, task.created_by, task.department_label]
            );

            // Activity log for creation
            await client.query(
                `INSERT INTO activity_log (task_id, user_id, action_type, details)
         VALUES ($1, $2, 'created', $3)`,
                [taskId, task.created_by, JSON.stringify({ title: task.title, department: task.department_label })]
            );
        }
        console.log(`✅ Created ${tasks.length} tasks`);

        // Add status change for blocked task with reason
        await client.query(
            `INSERT INTO task_status_changes (task_id, old_status, new_status, reason, changed_by)
       VALUES ($1, 'de_rezolvat', 'blocat', 'Lipsesc documentele necesare de la furnizor. Se așteaptă răspunsul lor.', $2)`,
            [taskIds[3], users[0].id]
        );

        // Add some subtasks
        const subtaskSets = [
            {
                taskIndex: 0, subtasks: [
                    { title: 'Colectare date de la departamente', is_completed: true, assigned_to: users[3].id },
                    { title: 'Analiza datelor financiare', is_completed: true, assigned_to: users[1].id },
                    { title: 'Redactare raport', is_completed: false, assigned_to: users[0].id },
                    { title: 'Revizuire finală', is_completed: false, assigned_to: users[1].id },
                    { title: 'Prezentare management', is_completed: false, assigned_to: null },
                ]
            },
            {
                taskIndex: 4, subtasks: [
                    { title: 'Evaluare soluții disponibile', is_completed: true, assigned_to: users[4].id },
                    { title: 'Configurare mediu de test', is_completed: true, assigned_to: users[4].id },
                    { title: 'Migrare date', is_completed: false, assigned_to: users[2].id },
                    { title: 'Training utilizatori', is_completed: false, assigned_to: null },
                    { title: 'Go-live', is_completed: false, assigned_to: null },
                ]
            },
        ];

        for (const set of subtaskSets) {
            for (let i = 0; i < set.subtasks.length; i++) {
                const st = set.subtasks[i];
                await client.query(
                    `INSERT INTO subtasks (task_id, title, is_completed, assigned_to, order_index)
           VALUES ($1, $2, $3, $4, $5)`,
                    [taskIds[set.taskIndex], st.title, st.is_completed, st.assigned_to, i]
                );
            }
        }
        console.log('✅ Created subtasks');

        // Add some comments
        await client.query(
            `INSERT INTO task_comments (task_id, author_id, content, mentions)
       VALUES ($1, $2, $3, $4)`,
            [taskIds[0], users[1].id, 'Am finalizat colectarea datelor. @Ana Dumitrescu te rog verifică cifrele de la departamentul 1.', `{${users[3].id}}`]
        );
        await client.query(
            `INSERT INTO task_comments (task_id, author_id, content, mentions)
       VALUES ($1, $2, $3, $4)`,
            [taskIds[0], users[3].id, 'Am verificat, totul este în regulă. Putem trece la redactare.', '{}']
        );
        console.log('✅ Created comments');

        console.log('\n✅ Seeding completed successfully!');
    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
