-- Migration 061: Translate Hungarian post descriptions to Romanian
-- These posts were created with Hungarian descriptions from the conversation,
-- but all user-facing text must be in Romanian.

-- Funcționare softuri (5-Calitate/Verificare)
UPDATE posts SET description = 'Se asigură că toate programele software utilizate de companie funcționează corect — sistem de email, abonamente AI, software de producție — totul trebuie să funcționeze, se monitorizează ca abonamentele să nu expire, pentru ca toți colegii să își poată desfășura activitatea fără probleme.'
WHERE name = 'Funcționare softuri'
AND description LIKE '%Minden létező szoftver%';

-- SOP (5-Calitate/Performanță)
UPDATE posts SET description = 'Elaborează proceduri standard de operare (SOP) pentru fiecare proces din companie — funcționarea biroului, producția, predarea produselor — pentru fiecare activitate trebuie să existe un SOP documentat.'
WHERE name = 'SOP'
AND description LIKE '%Minden egyes létező%';

-- Hardware (5-Calitate/Performanță)
UPDATE posts SET description = 'Se asigură că toate echipamentele hardware sunt funcționale și în stare optimă de funcționare.'
WHERE name = 'Hardware'
AND description LIKE '%Minden hardware%';

-- Funcționare birou (5-Calitate/Performanță)
UPDATE posts SET description = 'Se asigură că biroul funcționează optim în permanență — cafea, lapte, hârtie, pixuri, curățenie, întreținere — totul trebuie să fie în ordine pentru funcționarea eficientă a biroului.'
WHERE name = 'Funcționare birou'
AND description LIKE '%Biztosítja%';

-- Mașini (5-Calitate/Examinare)
UPDATE posts SET description = 'Verificare săptămânală a tuturor autoturismelor — curățenie, defecțiuni, programare service când este necesar. Se ocupă de tot ce ține de flota auto a companiei.'
WHERE name = 'Mașini'
AND description LIKE '%Leellenőrizni%';
