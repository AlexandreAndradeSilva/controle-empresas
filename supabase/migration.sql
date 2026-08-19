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

drop policy if exists "companies_select_own" on public.companies;
create policy "companies_select_own" on public.companies for select using (owner_id = auth.uid());
drop policy if exists "companies_insert_own" on public.companies;
create policy "companies_insert_own" on public.companies for insert with check (owner_id = auth.uid());
drop policy if exists "companies_update_own" on public.companies;
create policy "companies_update_own" on public.companies for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "companies_delete_own" on public.companies;
create policy "companies_delete_own" on public.companies for delete using (owner_id = auth.uid());

drop policy if exists "impostos_custom_select_own" on public.impostos_custom;
create policy "impostos_custom_select_own" on public.impostos_custom for select using (owner_id = auth.uid());
drop policy if exists "impostos_custom_insert_own" on public.impostos_custom;
create policy "impostos_custom_insert_own" on public.impostos_custom for insert with check (owner_id = auth.uid());
drop policy if exists "impostos_custom_update_own" on public.impostos_custom;
create policy "impostos_custom_update_own" on public.impostos_custom for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "impostos_custom_delete_own" on public.impostos_custom;
create policy "impostos_custom_delete_own" on public.impostos_custom for delete using (owner_id = auth.uid());

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings for select using (owner_id = auth.uid());
drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own" on public.user_settings for insert with check (owner_id = auth.uid());
drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own" on public.user_settings for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: bucket privado para os PDFs de guias anexados aos impostos.
-- Caminho usado pelo app: {owner_id}/{company_id}/{chave-do-imposto}_{timestamp}.pdf
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('guias', 'guias', false)
on conflict (id) do nothing;

drop policy if exists "guias_select_own" on storage.objects;
create policy "guias_select_own"
on storage.objects for select
using (bucket_id = 'guias' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "guias_insert_own" on storage.objects;
create policy "guias_insert_own"
on storage.objects for insert
with check (bucket_id = 'guias' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "guias_update_own" on storage.objects;
create policy "guias_update_own"
on storage.objects for update
using (bucket_id = 'guias' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "guias_delete_own" on storage.objects;
create policy "guias_delete_own"
on storage.objects for delete
using (bucket_id = 'guias' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Convites de uso único: só cria conta quem tem um código válido
-- ---------------------------------------------------------------------------
-- Fluxo completo:
--   1. O administrador insere uma linha em public.invites pelo SQL Editor
--      (exemplos prontos no final deste bloco) e entrega o código à pessoa.
--   2. A tela de cadastro chama a RPC public.invite_disponivel(code) só para
--      exibir uma mensagem decente ANTES de tentar criar a conta. Isso é
--      conveniência de UI, não é a trava de segurança.
--   3. O signup envia o código em options.data.invite_code, que o GoTrue grava
--      em auth.users.raw_user_meta_data. O trigger abaixo é quem de fato
--      valida, marca o convite como usado e aborta o cadastro se não prestar.
-- ---------------------------------------------------------------------------
create table if not exists public.invites (
  code text primary key,
  -- Apenas informativo: para quem o convite foi emitido. Não é conferido
  -- contra o e-mail usado no cadastro (por ora).
  email text,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  -- DEFERRABLE INITIALLY DEFERRED é obrigatório aqui: o trigger que preenche
  -- used_by roda em BEFORE INSERT ON auth.users, ou seja, ANTES de a linha do
  -- usuário existir. Com a checagem imediata (padrão), a FK estouraria; adiada
  -- para o commit, o usuário já foi gravado e a referência é válida.
  used_by uuid
    references auth.users(id) on delete set null
    deferrable initially deferred
);

-- RLS ligado e NENHUMA policy criada de propósito: sem policy, a tabela fica
-- completamente inacessível para as chaves anon/authenticated do app. O acesso
-- se dá apenas (a) pelo SQL Editor / service_role e (b) pelas funções
-- "security definer" abaixo, que rodam com os privilégios do dono e por isso
-- ignoram o RLS. Nunca crie policy aqui: os códigos não podem ser listáveis.
alter table public.invites enable row level security;
revoke all on table public.invites from anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC de conveniência: a UI pergunta "esse código existe e está livre?"
-- Devolve só um booleano — jamais o e-mail ou qualquer dado do convite.
-- ---------------------------------------------------------------------------
create or replace function public.invite_disponivel(p_code text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.invites
     where upper(code) = upper(p_code)
       and used_at is null
  );
$$;

grant execute on function public.invite_disponivel(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- A trava de verdade: trigger em auth.users que consome o convite
-- ---------------------------------------------------------------------------
create or replace function public.check_invite_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_rows integer;
begin
  -- raw_user_meta_data é jsonb no schema do GoTrue, então ->> e o operador "-"
  -- de remoção de chave (mais abaixo) funcionam direto, sem cast.
  v_code := nullif(trim(new.raw_user_meta_data ->> 'invite_code'), '');

  if v_code is null then
    raise exception 'É necessário um código de convite para criar a conta'
      using errcode = '22023';
  end if;

  -- O "and used_at is null" é o guarda de corrida: se dois cadastros
  -- simultâneos usarem o mesmo código, o segundo update fica bloqueado até o
  -- primeiro commitar e então não encontra mais a linha livre — row_count = 0
  -- e o cadastro é abortado. Um único convite nunca vira duas contas.
  update public.invites
     set used_at = now(),
         used_by = new.id
   where upper(code) = upper(v_code)
     and used_at is null;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    raise exception 'Código de convite inválido ou já utilizado'
      using errcode = '22023';
  end if;

  -- Não guardar o código nos metadados da conta criada.
  new.raw_user_meta_data := new.raw_user_meta_data - 'invite_code';

  return new;
end;
$$;

drop trigger if exists check_invite_on_signup on auth.users;
create trigger check_invite_on_signup
  before insert on auth.users
  for each row execute function public.check_invite_on_signup();

-- ---------------------------------------------------------------------------
-- Uso pelo administrador (rodar no SQL Editor)
-- ---------------------------------------------------------------------------
-- Gerar um convite com código aleatório e já devolver o código:
--
--   insert into public.invites (code, email)
--   values (
--     upper(left(replace(gen_random_uuid()::text, '-', ''), 10)),
--     'pessoa@exemplo.com'   -- opcional, pode ser null
--   )
--   returning code;
--
-- Gerar um convite com código escolhido à mão (a comparação NÃO diferencia
-- maiúsculas de minúsculas: 'EQUIPE-2026' e 'equipe-2026' são o mesmo código):
--
--   insert into public.invites (code, email)
--   values ('EQUIPE-2026', 'pessoa@exemplo.com');
--
-- Listar os convites, mostrando quais foram usados, por quem e quando:
--
--   select i.code,
--          i.email                                   as emitido_para,
--          i.created_at                              as criado_em,
--          case when i.used_at is null then 'livre'
--               else 'usado' end                     as situacao,
--          i.used_at                                 as usado_em,
--          u.email                                   as usado_por
--     from public.invites i
--     left join auth.users u on u.id = i.used_by
--    order by i.created_at desc;
--
-- Criar um usuário MANUALMENTE pelo painel (Authentication -> Users -> Add user):
-- o trigger barra qualquer insert em auth.users sem código de convite, inclusive
-- esse. Duas saídas:
--   (a) preferida — emita um convite e peça para a pessoa se cadastrar pelo app; ou
--   (b) desligue o trigger só durante a criação e religue em seguida:
--
--         alter table auth.users disable trigger check_invite_on_signup;
--         -- crie o usuário pelo painel agora
--         alter table auth.users enable  trigger check_invite_on_signup;
--
--       Não esqueça de religar: com o trigger desligado, qualquer pessoa cria
--       conta pelo app sem convite nenhum.
--
-- Revogar um convite ainda não usado:
--
--   delete from public.invites where code = 'EQUIPE-2026' and used_at is null;
-- ---------------------------------------------------------------------------
