/**
 * Seed budget categories from the "Penzugyi Tervezes Malaga.xlsx" structure.
 * Run via startup or manually.
 */
import pool from '../config/database';

interface CategoryDef {
    name: string;
    section: string;
    sectionLabel: string;
    isRevenue?: boolean;
    isSummary?: boolean;
    children?: Omit<CategoryDef, 'section' | 'sectionLabel' | 'children'>[];
}

const BUDGET_STRUCTURE: CategoryDef[] = [
    // === BEVÉTELEK ===
    {
        name: 'Kiszámlázott érték', section: 'bevetelek', sectionLabel: 'Bevételek',
        isRevenue: true,
    },
    {
        name: 'Partnerek', section: 'bevetelek', sectionLabel: 'Bevételek',
        isRevenue: true,
    },
    {
        name: 'ÁFA', section: 'bevetelek', sectionLabel: 'Bevételek',
        isRevenue: false, // AFA is a deduction
    },

    // === TARTALÉKOK ===
    {
        name: 'Céges tartalék', section: 'tartalekok', sectionLabel: 'Tartalékok',
        children: [
            { name: 'Tulajdonosi alap' },
            { name: 'Ügyvéd' },
            { name: 'Részletfizetés (Esalonare)' },
            { name: 'Suni' },
            { name: 'Partner bónuszok' },
            { name: 'Performia' },
        ],
    },
    {
        name: 'Fari', section: 'tartalekok', sectionLabel: 'Tartalékok',
        children: [
            { name: 'Arobs GPS' },
        ],
    },

    // === KORRIGÁLT ÖSSZEVÉTEL (számított sor) ===
    {
        name: 'Korrigált összbevétel — ezt lehet elkölteni', section: 'osszesito', sectionLabel: 'Összesítő',
        isSummary: true,
    },

    // === 7 — ÜGYVEZETŐ ===
    {
        name: 'Ügyvezető', section: 'dept_7', sectionLabel: '7 — Ügyvezető',
    },

    // === IRODA ===
    {
        name: 'Iroda (házbér, fogyóanyag, gáz, villany, stb.)', section: 'iroda', sectionLabel: 'Iroda',
    },

    // === TESZTELÉSEK ===
    {
        name: 'Tesztelések (innováció + szoftok + új termék)', section: 'teszteles', sectionLabel: 'Tesztelések',
    },

    // === 1 — KOMMUNIKÁCIÓ + HR ===
    {
        name: 'Kommunikáció + HR', section: 'dept_1', sectionLabel: '1 — Kommunikáció + HR',
        children: [
            { name: 'Diurnák' },
            { name: 'Szállások' },
            { name: 'Bérletek' },
            { name: 'Fizetések' },
            { name: 'Bónuszok' },
            { name: 'Belső protokol' },
            { name: 'Bolt' },
            { name: 'Fizetés utáni adó' },
            { name: 'Dividensek' },
            { name: 'Biztosítások' },
            { name: 'Vodafone' },
            { name: 'Posta költségek' },
            { name: 'Alkalmazás' },
        ],
    },

    // === 2 — ÉRTÉKESÍTÉS + MARKETING ===
    {
        name: 'Értékesítés + Marketing', section: 'dept_2', sectionLabel: '2 — Értékesítés + Marketing',
        children: [
            { name: 'Autók (leasing + üzemanyag + autómosás + útdíjak)' },
            { name: 'Promóciók' },
            { name: 'Külső protokol' },
        ],
    },

    // === 3 — PÉNZÜGY ===
    {
        name: 'Pénzügy', section: 'dept_3', sectionLabel: '3 — Pénzügy',
        children: [
            { name: 'Könyvelés' },
            { name: 'Bank részlet' },
            { name: 'Banki költségek' },
            { name: 'Vagyontárgyak' },
            { name: 'Autó adó' },
            { name: 'Profit adó' },
        ],
    },

    // === 4 — TERMELÉS ===
    {
        name: 'Termelés', section: 'dept_4', sectionLabel: '4 — Termelés',
    },

    // === 5 — MINŐSÉG ===
    {
        name: 'Minőség', section: 'dept_5', sectionLabel: '5 — Minőség',
        children: [
            { name: 'Irodatakarítás' },
            { name: 'PSI' },
            { name: 'Tanulás' },
            { name: 'SSM' },
        ],
    },

    // === 6 — TERJESZKEDÉS ===
    {
        name: 'Terjeszkedés', section: 'dept_6', sectionLabel: '6 — Terjeszkedés',
        children: [
            { name: 'Események' },
        ],
    },

    // === ÖSSZESÍTŐ SOROK ===
    {
        name: 'Összköltség', section: 'osszesito', sectionLabel: 'Összesítő',
        isSummary: true,
    },
    {
        name: 'Eredmény (bevétel - kiadás)', section: 'osszesito', sectionLabel: 'Összesítő',
        isSummary: true,
    },
    {
        name: 'Kintlévőségek', section: 'osszesito', sectionLabel: 'Összesítő',
        isSummary: true,
    },
    {
        name: 'Leszolgáltatott (de nincs kiszámlázva)', section: 'osszesito', sectionLabel: 'Összesítő',
        isSummary: true,
    },
    {
        name: 'Kassza (mennyi pénzünk van)', section: 'osszesito', sectionLabel: 'Összesítő',
        isSummary: true,
    },
    {
        name: 'Tartozások', section: 'osszesito', sectionLabel: 'Összesítő',
        isSummary: true,
    },
];

export async function seedBudgetCategories(): Promise<void> {
    const client = await pool.connect();
    try {
        // Check if categories already exist
        const { rows } = await client.query('SELECT COUNT(*) FROM budget_categories');
        if (parseInt(rows[0].count, 10) > 0) {
            console.log('ℹ️  Budget categories already seeded, skipping');
            return;
        }

        await client.query('BEGIN');

        let globalOrder = 0;

        for (const cat of BUDGET_STRUCTURE) {
            const { rows: [parent] } = await client.query(
                `INSERT INTO budget_categories (name, section, section_label, parent_id, order_index, is_summary_row, is_revenue)
                 VALUES ($1, $2, $3, NULL, $4, $5, $6) RETURNING id`,
                [cat.name, cat.section, cat.sectionLabel, globalOrder++, cat.isSummary || false, cat.isRevenue || false]
            );

            if (cat.children) {
                for (let i = 0; i < cat.children.length; i++) {
                    const child = cat.children[i];
                    await client.query(
                        `INSERT INTO budget_categories (name, section, section_label, parent_id, order_index, is_summary_row, is_revenue)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [child.name, cat.section, cat.sectionLabel, parent.id, i, false, child.isRevenue || false]
                    );
                }
            }
        }

        await client.query('COMMIT');
        console.log('✅ Budget categories seeded successfully');
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('❌ Budget category seed error:', err.message);
    } finally {
        client.release();
    }
}
