-- Migration 083: per-company holiday calendars.
--
-- recurring_tasks.workdays_only previously only skipped weekends (Sat/Sun).
-- For Hungary that misses national holidays (Mar 15, Aug 20, Oct 23, etc.),
-- causing recurring tasks to fire on days nobody is working. Same applies to
-- Romanian holidays for the RO tenants — but the calendars differ, so the
-- correct place to model this is per-company.
--
-- A row in company_holidays means: this date is a non-working day for that
-- company. The recurring engine treats it like a weekend and rolls forward.

CREATE TABLE IF NOT EXISTS company_holidays (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    holiday_date    DATE NOT NULL,
    name            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_company_holidays_company_date
    ON company_holidays(company_id, holiday_date);

-- Seed national holidays for 2026 and 2027 for every existing company,
-- choosing the right set based on the company's language. Re-runnable
-- thanks to the UNIQUE constraint + ON CONFLICT DO NOTHING.

-- Hungarian holidays (for language='hu' tenants).
INSERT INTO company_holidays (company_id, holiday_date, name)
SELECT c.id, d.holiday_date, d.name
FROM companies c
CROSS JOIN (VALUES
    (DATE '2026-01-01', 'Újév'),
    (DATE '2026-03-15', 'Nemzeti ünnep'),
    (DATE '2026-04-06', 'Húsvét hétfő'),
    (DATE '2026-05-01', 'Munka ünnepe'),
    (DATE '2026-05-25', 'Pünkösd hétfő'),
    (DATE '2026-08-20', 'Államalapítás ünnepe'),
    (DATE '2026-10-23', 'Az 1956-os forradalom ünnepe'),
    (DATE '2026-11-01', 'Mindenszentek'),
    (DATE '2026-12-25', 'Karácsony'),
    (DATE '2026-12-26', 'Karácsony másnapja'),
    (DATE '2027-01-01', 'Újév'),
    (DATE '2027-03-15', 'Nemzeti ünnep'),
    (DATE '2027-03-29', 'Húsvét hétfő'),
    (DATE '2027-05-01', 'Munka ünnepe'),
    (DATE '2027-05-17', 'Pünkösd hétfő'),
    (DATE '2027-08-20', 'Államalapítás ünnepe'),
    (DATE '2027-10-23', 'Az 1956-os forradalom ünnepe'),
    (DATE '2027-11-01', 'Mindenszentek'),
    (DATE '2027-12-25', 'Karácsony'),
    (DATE '2027-12-26', 'Karácsony másnapja')
) AS d(holiday_date, name)
WHERE c.language = 'hu'
ON CONFLICT (company_id, holiday_date) DO NOTHING;

-- Romanian holidays (for language='ro' tenants).
INSERT INTO company_holidays (company_id, holiday_date, name)
SELECT c.id, d.holiday_date, d.name
FROM companies c
CROSS JOIN (VALUES
    (DATE '2026-01-01', 'Anul Nou'),
    (DATE '2026-01-02', 'Anul Nou'),
    (DATE '2026-01-24', 'Unirea Principatelor Române'),
    (DATE '2026-04-03', 'Vinerea Mare'),
    (DATE '2026-04-05', 'Paștele'),
    (DATE '2026-04-06', 'Paștele'),
    (DATE '2026-05-01', 'Ziua Muncii'),
    (DATE '2026-06-01', 'Ziua Copilului'),
    (DATE '2026-05-24', 'Rusalii'),
    (DATE '2026-05-25', 'Rusalii'),
    (DATE '2026-08-15', 'Adormirea Maicii Domnului'),
    (DATE '2026-11-30', 'Sfântul Andrei'),
    (DATE '2026-12-01', 'Ziua Națională'),
    (DATE '2026-12-25', 'Crăciunul'),
    (DATE '2026-12-26', 'Crăciunul'),
    (DATE '2027-01-01', 'Anul Nou'),
    (DATE '2027-01-02', 'Anul Nou'),
    (DATE '2027-01-24', 'Unirea Principatelor Române'),
    (DATE '2027-04-30', 'Vinerea Mare'),
    (DATE '2027-05-02', 'Paștele'),
    (DATE '2027-05-03', 'Paștele'),
    (DATE '2027-05-01', 'Ziua Muncii'),
    (DATE '2027-06-01', 'Ziua Copilului'),
    (DATE '2027-06-20', 'Rusalii'),
    (DATE '2027-06-21', 'Rusalii'),
    (DATE '2027-08-15', 'Adormirea Maicii Domnului'),
    (DATE '2027-11-30', 'Sfântul Andrei'),
    (DATE '2027-12-01', 'Ziua Națională'),
    (DATE '2027-12-25', 'Crăciunul'),
    (DATE '2027-12-26', 'Crăciunul')
) AS d(holiday_date, name)
WHERE c.language = 'ro'
ON CONFLICT (company_id, holiday_date) DO NOTHING;
