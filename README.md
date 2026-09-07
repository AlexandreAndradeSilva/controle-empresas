# FISCAL CONTROL

Sistema web (frontend + Supabase como backend) para controle de empresas contábeis: cadastro, apuração mensal, impostos, declarações, obrigações, calendário de vencimentos, metas, relatórios, senhas de acesso, histórico e backup.

## Status atual

- [x] Projeto criado no Supabase
- [x] `supabase/migration.sql` executado no SQL Editor do projeto
- [x] Usuário de login criado em Authentication → Users
- [x] `window.SUPABASE_CONFIG` no final do `index.html` preenchido com a URL e a anon key reais
- [ ] "Confirm email" desligado em Authentication → Providers → Email (necessário para o cadastro por convite entrar direto)
- [ ] **Bloco "Atualização de schema" do `supabase/migration.sql` rodado** — obrigatório para esta versão (ver abaixo)

> **Atualizando um projeto que já existia:** esta versão acrescentou colunas
> (ISSQN, Fator R, obrigações, vencimento por imposto, cronômetro, prioridade…) e
> guarda metas e relatórios arquivados em `user_settings`. Os `create table if not
> exists` do topo da migration **não** alteram tabela que já existe — quem faz isso
> é o bloco **"Atualização de schema (FISCAL CONTROL)"** no fim do arquivo. Rode-o
> no SQL Editor antes de publicar o frontend novo, senão o app salva errado. Ele é
> idempotente (`add column if not exists`) e não apaga dado nenhum; a única coisa
> que ele reescreve é `responsavel_empresa`, que passou de objeto único para lista
> — convertendo o que já estava lá, sem perder conteúdo.

A `anonKey` versionada aqui é pública por natureza — quem protege os dados é a
Row Level Security do banco, não o sigilo dessa chave. Trocar de projeto Supabase
exige editar o bloco `SUPABASE_CONFIG` no fim do `index.html`.

## Acesso: login e cadastro por convite

Não há cadastro aberto. Para alguém criar conta é preciso um **código de convite de
uso único**, emitido pelo administrador no SQL Editor:

```sql
insert into public.invites (code, email)
values (upper(left(replace(gen_random_uuid()::text,'-',''),12)), 'pessoa@escritorio.com.br')
returning code;
```

A validação real acontece no banco, num trigger `before insert on auth.users` — não
no JavaScript. Isso é proposital: a anon key é pública, então qualquer checagem feita
só no cliente seria contornável pelo console do navegador. A tela chama a função
`invite_disponivel()` apenas para exibir uma mensagem de erro legível antes de tentar.

Cada usuário enxerga somente as próprias empresas (Row Level Security por `owner_id`).

**Consequência a conhecer:** o trigger barra qualquer inserção em `auth.users` sem
código, inclusive o botão "Add user" do painel do Supabase. Para criar alguém à mão,
emita um convite ou desligue o trigger temporariamente — o procedimento está
comentado no fim de `supabase/migration.sql`.

## Estrutura

```
index.html               markup (login, telas e modais)
css/styles.css           estilos
supabase/migration.sql   schema do banco (rodar no SQL Editor do seu projeto)
controle-empresas_8.html artefato monolítico de referência — a versão que este app porta

js/
  main.js            boot: sessão, carga inicial e ligação dos módulos
  auth.js            entrar, criar conta por convite, sair, alterar senha
  state.js           DATA + mapeamento com o Supabase (carregar / salvar tudo)
  fields.js          campos de domínio por bloco e cálculo do progresso
  utils.js           helpers de formatação, datas, tempo e gráficos
  modal.js           abrir/fechar modais e o diálogo de confirmação
  companies.js       tela inicial, cadastro/edição e empresas arquivadas
  perfil.js          perfil da empresa, seções da apuração e cronômetro
  apuracao.js        Apuração do Mês (contagens, filtros, prioridade, ordem manual)
  calendario.js      Calendário de Vencimentos e lembrete da Guia ISS
  metas.js           metas e avisos
  relatorio.js       relatório, gráficos e exportação para Excel
  historico.js       encerrar mês, meses anteriores e detalhe de imposto
  guias.js           PDFs das guias (Storage do Supabase)
  impostosCustom.js  Gerenciar Impostos (padrão do sistema + adicionados)
  pdf.js             PDF por empresa no encerramento do mês
  excel.js           exportação da lista de empresas
  backup.js          exportar/importar `.json` e apagar tudo
  supabaseClient.js  cliente do Supabase
```

## Configurar o backend (Supabase)

1. Crie um projeto em https://supabase.com (gratuito).
2. No **SQL Editor** do projeto, cole e rode todo o conteúdo de `supabase/migration.sql`. Isso cria as tabelas, ativa a Row Level Security (cada usuário só vê os próprios dados) e cria o bucket privado `guias` para os PDFs anexados.
3. Em **Authentication → Providers**, deixe apenas E-mail/Senha ativado. Em **Authentication → Users**, crie manualmente o(s) usuário(s) que vão acessar o sistema (não há cadastro público — só quem você criar consegue entrar).
4. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.

## Configurar o frontend

Edite o bloco no final do `index.html`:

```html
<script>
  window.SUPABASE_CONFIG = {
    url: 'https://SEU-PROJETO.supabase.co',
    anonKey: 'SUA_ANON_KEY_PUBLICA'
  };
</script>
```

A `anonKey` é pública por natureza — quem protege os dados é a Row Level Security do banco, não o sigilo dessa chave.

## Rodar localmente

Como o app usa ES modules (`<script type="module">`), ele precisa ser servido por http(s), não aberto direto como arquivo (`file://`). Qualquer servidor estático resolve, por exemplo:

```
npx serve .
```

e acesse o endereço que ele mostrar (ex.: http://localhost:3000).

Para publicar de verdade, hospede esses mesmos arquivos estáticos em qualquer serviço (Netlify, Vercel, GitHub Pages, etc.) — não há nada além de HTML/CSS/JS estático além do Supabase.

## Atenção: chaves de imposto mudaram

Na versão anterior os impostos eram seis campos fixos (`difal`, `crf`, `irrf`,
`reinf`, `issqnPrest`, `issqnToma`). Agora os impostos padrão do sistema variam
por regime e têm outras chaves (`sis_difal`, `sis_efd_reinf`, `sis_icms`…).

**Nada foi apagado** — o que estava preenchido continua gravado no banco com as
chaves antigas, mas deixa de aparecer na tela, porque a tela agora procura as
chaves novas. A correspondência não é completa (`crf` não tem equivalente, e
`irrf` virou um *tipo* dentro do REINF em vez de um imposto próprio), então o
renomear **não roda sozinho**: o SQL está pronto e comentado no fim de
`supabase/migration.sql`, junto com uma consulta para ver empresa por empresa o
que existe hoje. Decida o que faz sentido antes de aplicar.

Meses já encerrados (o `historico` de cada empresa) não são tocados: são o retrato
do que foi apurado na época.

## O que veio nesta versão (port do `controle-empresas_8.html`)

O app modular vinha do artefato `_3`; esta versão o alinha ao `_8`:

- **Metas e avisos** — metas por recorte de empresas (regime, Fator R, ISSQN, sem
  movimento) com uma ação a cumprir e prazo, metas de ritmo semanal e metas
  numéricas livres; avisam ao passar do limiar e quando o prazo se aproxima.
- **Calendário de Vencimentos** — alimentado pela data preenchida em cada imposto,
  mais o lembrete mensal da Guia ISS. A marcação de "enviado" é própria do
  calendário: ela não mexe no status da apuração.
- **Relatório** — tempo de apuração e impostos concluídos por empresa, proporção da
  carteira, comparativo entre meses encerrados, calendário de empresas concluídas
  por dia, e exportação para Excel com uma coluna de gráfico em barras de texto.
- **Apuração do Mês** — prioridade de A+ a D, ordenação (inclusive arrastando),
  filtros por dificuldade/regime/ISSQN/Fator R e cronômetro por empresa.
- **Novos blocos por empresa** — Obrigações (Entrega de MIT, e o DCTF WEB migra
  para cá no Lucro Presumido/Real), Fator R, tipos do REINF (CSLL, IRRF, IRRF
  Aluguel) e valor + vencimento por imposto.
- **Impostos padrão do sistema** — lista pronta por regime, que dá para desligar
  globalmente em "Gerenciar Impostos" ou forçar ativo/inativo em uma empresa só.
- **Vários responsáveis e vários sistemas** por empresa (antes era um de cada).
- **ISSQN prestado/tomado** e dia de vencimento da Guia ISS no cadastro.

O cálculo do progresso mudou junto: os novos blocos entram na conta, e "Andamento"
agora começa acima de 40% (antes, acima de 0%).

## O que mudou em relação ao arquivo único original

- **Backend real**: os dados eram salvos com `window.storage` (API exclusiva de artefatos do Claude); agora ficam no Postgres do Supabase, com login obrigatório e Row Level Security.
- **Guias em PDF**: antes ficavam embutidas em base64 dentro do próprio registro; agora vão para o Storage do Supabase (bucket `guias`), e o app pede uma URL assinada para ver/baixar.
- **Removido**: o recurso de "conectar pasta local" / "pastas salvas" (File System Access API + IndexedDB) — era um contorno específico do sandbox do Claude, redundante com um banco de dados de verdade. O botão "Encerrar mês" continua oferecendo salvar os PDFs numa pasta local (quando o navegador permitir) ou baixar um `.zip`, mas exportar/importar backup em `.json` é a via principal de backup manual.
- **Tudo o resto** é a mesma lógica do artefato, só reorganizada em `js/*.js` por domínio.

## Observações

- A função `exportExcel()` (em `js/excel.js`) exporta a lista de empresas e já vinha
  pronta no artefato sem nenhum botão que a chamasse — continua assim. O botão
  "Exportar Excel" do Relatório é outra função (`exportarRelatorioExcel`, em
  `js/relatorio.js`), essa sim ligada na interface.
- O modal "Próximos vencimentos" (`#modalVenc`) existe no markup mas nenhuma tela
  leva até ele — exatamente como no artefato, mantido para não divergir dele.
