-- Migration 067: Enable `unaccent` extension for diacritics-insensitive search.
-- This lets queries like unaccent('Ș') match 's', unaccent('ă') match 'a', etc.
-- Used by the global search endpoint so "sarcin" finds "sarcină", "plati" finds "plăți", etc.

CREATE EXTENSION IF NOT EXISTS unaccent;

-- A lightweight IMMUTABLE wrapper is required to use unaccent() inside expression indexes.
-- We don't create an index yet (table sizes are small); the function is still useful
-- so callers can reference f_unaccent() in queries and swap implementations later.
CREATE OR REPLACE FUNCTION f_unaccent(text)
RETURNS text AS $$
    SELECT unaccent('unaccent', $1);
$$ LANGUAGE SQL IMMUTABLE STRICT;
