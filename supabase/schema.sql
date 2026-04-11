-- ============================================================
--  STITCH CRM — Schema do Banco de Dados (Supabase)
--  Execute este script no: Supabase Dashboard → SQL Editor
--  Crie as tabelas uma vez e pronto.
-- ============================================================

-- TABELA: Negócios (Pipeline)
create table if not exists deals (
  id            uuid primary key default gen_random_uuid(),
  title         text        not null,
  company       text        not null,
  value         numeric     not null default 0,
  stage         text        not null default 'discovery',  -- discovery | negotiation | proposal | closing
  status        text        not null default 'new',        -- new | hot | at-risk
  tags          text[],
  owner_name    text,
  owner_avatar  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- TABELA: Empresas
create table if not exists companies (
  id                  uuid primary key default gen_random_uuid(),
  name                text        not null,
  stage               text        not null default 'Prospecção',
  sector              text,
  tax_id              text,           -- CNPJ
  score               integer     not null default 0,
  logo                text,
  responsible         text,
  responsible_avatar  text,
  created_at          timestamptz not null default now()
);

-- TABELA: Contatos
create table if not exists contacts (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  avatar        text,
  role          text,
  company       text,
  email         text,
  phone         text,
  owner         text,
  owner_avatar  text,
  created_at    timestamptz not null default now()
);

-- TABELA: Tarefas
create table if not exists tasks (
  id                    uuid primary key default gen_random_uuid(),
  title                 text        not null,
  status                text        not null default 'pending',  -- pending | completed
  priority              text        not null default 'medium',   -- high | medium | low
  type                  text        not null default 'task',     -- call | meeting | email | visit
  due_date              text,
  due_time              text,
  deal_id               uuid        references deals(id) on delete cascade,
  user_id               uuid,
  org_id                uuid,
  assigned_to_avatars   text[]      default '{}',
  created_at            timestamptz not null default now()
);

-- TABELA: Histórico de Negócios (Timeline)
create table if not exists deal_timeline (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid        references deals(id) on delete cascade,
  type        text        not null, -- created | stage_change | task | note
  description text        not null,
  created_at  timestamptz not null default now()
);

-- TABELA: Vínculo Deal <-> Contact
create table if not exists deal_contacts (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid references deals(id) on delete cascade,
  contact_id  uuid references contacts(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ============================================================
--  Row Level Security (RLS) — Protege os dados por usuário
--  Habilite depois de criar as políticas de autenticação.
--  Por enquanto, deixe desabilitado para desenvolvimento.
-- ============================================================
-- alter table deals     enable row level security;
-- alter table companies enable row level security;
-- alter table contacts  enable row level security;
-- alter table tasks     enable row level security;

-- ============================================================
--  Dados de Exemplo (OPCIONAL)
--  Descomente e execute para popular o banco com dados demo.
-- ============================================================
/*
insert into deals (title, company, value, stage, status, tags) values
  ('Expansão de Infraestrutura', 'Aether Dynamics', 1250000, 'discovery', 'new', '{"Nova Oportunidade"}'),
  ('Cloud de Pesquisa IA',       'Neural Systems',  5200000, 'negotiation', 'hot', '{"Estratégico"}'),
  ('Suite de Cibersegurança',    'Vanguard Defense', 2100000, 'proposal', 'hot', '{"Urgente"}');

insert into companies (name, stage, sector, tax_id, score) values
  ('Logística Global S.A.', 'Cliente Ativo', 'Transporte & Logística', '12.345.678/0001-90', 88),
  ('Sistemas Neurais Ltda',  'Negociação',   'Tecnologia & IA',        '98.765.432/0001-10', 94);

insert into contacts (name, role, company, email, phone) values
  ('Juliana DeMarco', 'VP de Vendas',       'Aurora Tech', 'juliana@aurora.com.br', '(11) 98765-4321'),
  ('Marcos Thorne',   'CTO',                'NexaGrid',    'm.thorne@nexagrid.com', '(21) 99887-7665'),
  ('Clara Silveira',  'Diretora de Ops',    'GlobalLog',   'clara@globallog.com.br', '(31) 91234-5678');

insert into tasks (title, status, priority, due_date) values
  ('Preparar documentação de compliance', 'pending',   'high',   '12 Out, 2024 • 14:00'),
  ('Reunião de alinhamento com CTO',      'completed', 'medium', '10 Out, 2024 • 10:00'),
  ('Revisão de contrato jurídico',        'overdue',   'high',   '08 Out, 2024 • 17:00');
*/
