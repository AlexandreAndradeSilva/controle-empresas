-- Controle de Empresas — schema do Supabase (Postgres + Auth + Storage)
-- Rode este script inteiro no SQL Editor do seu projeto Supabase.

-- ---------------------------------------------------------------------------
-- Tabela principal: uma linha por empresa cadastrada.
-- "id" é texto (não uuid) porque o app gera ids como "emp_kx3f8v2ab" no
-- próprio navegador (função uid() em js/utils.js) — mantém a mesma lógica.
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),

  numero text default '',
  razao_social text not null,
  cnpj text default '',
  ie text default '',
  atividade text default '',
  municipio text default '',
  uf text default '',
  dificuldade text default 'FACIL',
  responsaveis text default '',
  regime text default '',
  status text default 'PENDENTE',
  vencimento date,
  baixada boolean not null default false,
  motivo_baixa text default '',
  data_baixa timestamptz,
  situacao_documentos text default '',
  observacoes text default '',
  observacoes_apuracao text default '',

  responsavel_empresa jsonb not null default '{}',
  senhas jsonb not null default '{}',
  documentos jsonb not null default '{}',
  documentos_padrao jsonb not null default '{}',
  declaracao jsonb not null default '{}',
  declaracao_padrao jsonb not null default '{}',
  impostos jsonb not null default '{}',
  impostos_padrao jsonb not null default '{}',
  impostos_valores jsonb not null default '{}',
  impostos_guias jsonb not null default '{}',
  historico jsonb not null default '[]',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_owner_id_idx on public.companies(owner_id);

-- ---------------------------------------------------------------------------
-- Impostos customizados ("Gerenciar Impostos"), equivalente a DATA.impostosCustom
-- ---------------------------------------------------------------------------
create table if not exists public.impostos_custom (
  key text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  label text not null,
  regimes text[] not null default '{}',
  position integer not null default 0
);

create index if not exists impostos_custom_owner_id_idx on public.impostos_custom(owner_id);

-- ---------------------------------------------------------------------------
-- Configurações por usuário (hoje só a ordem manual da Apuração do Mês)
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  ordem_apuracao_manual jsonb not null default '[]'
);

-- ---------------------------------------------------------------------------
-- Row Level Security: cada usuário só enxerga/edita os próprios dados
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.impostos_custom enable row level security;
alter table public.user_settings enable row level security;

create policy "companies_select_own" on public.companies for select using (owner_id = auth.uid());
create policy "companies_insert_own" on public.companies for insert with check (owner_id = auth.uid());
create policy "companies_update_own" on public.companies for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "companies_delete_own" on public.companies for delete using (owner_id = auth.uid());

create policy "impostos_custom_select_own" on public.impostos_custom for select using (owner_id = auth.uid());
create policy "impostos_custom_insert_own" on public.impostos_custom for insert with check (owner_id = auth.uid());
create policy "impostos_custom_update_own" on public.impostos_custom for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "impostos_custom_delete_own" on public.impostos_custom for delete using (owner_id = auth.uid());

create policy "user_settings_select_own" on public.user_settings for select using (owner_id = auth.uid());
create policy "user_settings_insert_own" on public.user_settings for insert with check (owner_id = auth.uid());
create policy "user_settings_update_own" on public.user_settings for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: bucket privado para os PDFs de guias anexados aos impostos.
-- Caminho usado pelo app: {owner_id}/{company_id}/{chave-do-imposto}_{timestamp}.pdf
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('guias', 'guias', false)
on conflict (id) do nothing;

create policy "guias_select_own"
on storage.objects for select
using (bucket_id = 'guias' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "guias_insert_own"
on storage.objects for insert
with check (bucket_id = 'guias' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "guias_update_own"
on storage.objects for update
using (bucket_id = 'guias' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "guias_delete_own"
on storage.objects for delete
using (bucket_id = 'guias' and (storage.foldername(name))[1] = auth.uid()::text);
