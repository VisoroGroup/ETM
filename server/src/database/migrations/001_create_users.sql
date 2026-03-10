-- Migration 001: Create users table
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'user');
CREATE TYPE department_type AS ENUM (
  'departament_1', 'departament_2', 'departament_3', 'departament_4',
  'departament_5', 'departament_6', 'departament_7'
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  microsoft_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  department department_type DEFAULT 'departament_1',
  role user_role DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_microsoft_id ON users(microsoft_id);
CREATE INDEX idx_users_email ON users(email);
