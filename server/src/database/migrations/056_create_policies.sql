-- Migration 056: Create policies tables
-- Policies are uploaded HTML directives with 3 scopes: COMPANY, DEPARTMENT, POST
-- Many-to-many relationship with departments and posts via junction tables

CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  directive_number INTEGER,
  title VARCHAR(500) NOT NULL,
  date DATE NOT NULL,
  content_html TEXT NOT NULL,
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('COMPANY', 'DEPARTMENT', 'POST')),
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_policies_scope ON policies(scope);
CREATE INDEX idx_policies_is_active ON policies(is_active);
CREATE INDEX idx_policies_date ON policies(date DESC);
CREATE INDEX idx_policies_directive_number ON policies(directive_number);

-- Junction: policy <-> department (for DEPARTMENT scope)
CREATE TABLE IF NOT EXISTS policy_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(policy_id, department_id)
);

CREATE INDEX idx_policy_departments_policy_id ON policy_departments(policy_id);
CREATE INDEX idx_policy_departments_department_id ON policy_departments(department_id);

-- Junction: policy <-> post (for POST scope)
CREATE TABLE IF NOT EXISTS policy_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(policy_id, post_id)
);

CREATE INDEX idx_policy_posts_policy_id ON policy_posts(policy_id);
CREATE INDEX idx_policy_posts_post_id ON policy_posts(post_id);
