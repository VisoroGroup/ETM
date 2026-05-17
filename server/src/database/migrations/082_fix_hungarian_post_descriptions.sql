-- Migration 082: Fix Hungarian post descriptions seeded in 055.
--
-- Five posts in the Visoro Global Romanian tenant were seeded with Hungarian
-- descriptions in migration 055 (auditor finding). Romanian users see foreign
-- text inside an otherwise Romanian UI. Replace with Romanian equivalents
-- while keeping the same meaning.
--
-- Idempotent: only updates rows whose current description still matches the
-- original Hungarian seed text, so re-runs are no-ops and an already-edited
-- description by Robert is left alone.

UPDATE posts
SET description = 'Toate softurile pe care le folosim — sistem email, abonamente AI, softuri necesare producției — să funcționeze, să fie monitorizate, să nu expire subscripțiile, ca toată lumea să-și poată face treaba liniștit.',
    updated_at = NOW()
WHERE name = 'Funcționare softuri'
  AND description LIKE 'Minden létező szoftver%';

UPDATE posts
SET description = 'A verifica săptămânal mașinile — să fie curate, să nu aibă defecțiuni. A le duce la service când e cazul, și orice ține de flota auto.',
    updated_at = NOW()
WHERE name = 'Mașini'
  AND description LIKE 'Leellenőrizni%';

UPDATE posts
SET description = 'Scrie SOP-uri pentru fiecare proces existent în firmă — fie că e funcționare birou, producția produsului, livrarea produsului — pentru toate trebuie să existe SOP.',
    updated_at = NOW()
WHERE name = 'SOP'
  AND description LIKE 'Minden egyes létező folyamatról%';

UPDATE posts
SET description = 'Ține tot hardware-ul în funcțiune și are grijă ca echipamentele să fie la zi și mereu în formă maximă.',
    updated_at = NOW()
WHERE name = 'Hardware'
  AND description LIKE 'Minden hardware%';

UPDATE posts
SET description = 'Se asigură că în birou sunt mereu cafea, lapte, hârtie, pixuri, e curățenie, biroul e întreținut, iar întreaga ambianță funcționează optim.',
    updated_at = NOW()
WHERE name = 'Funcționare birou'
  AND description LIKE 'Biztosítja%';
