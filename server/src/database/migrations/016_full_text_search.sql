-- Migration 016: Full-text search with tsvector
-- Adds a tsvector column to tasks for fast PostgreSQL full-text search

-- Add tsvector column
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate tsvector for existing rows (title AND description)
UPDATE tasks SET search_vector =
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B');

-- Create GIN index for fast full-text queries
CREATE INDEX IF NOT EXISTS idx_tasks_search_vector ON tasks USING GIN(search_vector);

-- Trigger to auto-update search_vector on INSERT/UPDATE
CREATE OR REPLACE FUNCTION tasks_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_search_vector_trigger ON tasks;
CREATE TRIGGER tasks_search_vector_trigger
    BEFORE INSERT OR UPDATE OF title, description
    ON tasks
    FOR EACH ROW EXECUTE FUNCTION tasks_search_vector_update();
