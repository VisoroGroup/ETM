-- Migration 053: Create departments table (replaces department_type enum for org structure)
-- The old department_type enum stays for backward compatibility during transition

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  color VARCHAR(20) NOT NULL,
  head_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  pfv TEXT,
  statistic_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_departments_sort_order ON departments(sort_order);
CREATE INDEX idx_departments_is_active ON departments(is_active);

-- Seed the 7 departments in LRH order: 7, 1, 2, 3, 4, 5, 6
-- head_user_id will be set in a later migration after posts are created

INSERT INTO departments (name, sort_order, color, pfv, statistic_name) VALUES
  ('7 - Administrativ', 1, '#3B82F6', 'O firmă solventă și în creștere continuă!', 'Cash & Bill'),
  ('1 - HR - Comunicare', 2, '#EAB308', 'O organizație cu fundație solidă, cu colegi puși pe post, care sunt trainuiți și lucrează foarte eficient pe bază de statistici.', 'Nr. statistici în creștere vs nr. total statistici'),
  ('2 - Vânzări', 3, '#8B5CF6', 'Vânzări realizate în atâta cantitate, încât încasările sunt mai mari decât cheltuielile plus banii puși deoparte. Produse de calitate renumite.', 'Valoarea contractelor încheiate'),
  ('3 - Financiar', 4, '#EF4444', 'Patrimoniul firmei și banii sunt îngrijite în siguranță maximă.', 'Facturi achitate la timp vs facturi neachitate la termen, cantitativ și valoric'),
  ('4 - Producție', 5, '#22C55E', 'Servicii realizate la scară largă pentru clienți, în timpul, calitatea și cheltuielile promise, cu ajutorul cărora începe punerea în ordine a administrației publice locale.', 'Produse predate cantitativ vs valoric'),
  ('5 - Calitate și calificare', 6, '#6B7280', 'Colegi instruiți, care lucrează eficace cu rezultate foarte bune. O organizație, care oferă servicii de înaltă calitate.', 'Adaos per angajat și încasări per angajat'),
  ('6 - Extindere', 7, '#F97316', 'Un cerc de clienți potențiali, în constantă creștere și un renume foarte bun la nivel național.', 'Numărul de clienți potențiali noi');
