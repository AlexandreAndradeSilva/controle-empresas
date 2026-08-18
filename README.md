# Controle de Empresas

Sistema web (frontend + Supabase como backend) para controle de empresas contábeis: cadastro, apuração mensal, impostos, declarações, senhas de acesso, histórico e backup.

## Status atual

- [ ] Projeto criado no Supabase
- [ ] `supabase/migration.sql` executado no SQL Editor do projeto
- [ ] Usuário de login criado em Authentication → Users
- [ ] `window.SUPABASE_CONFIG` no final do `index.html` preenchido com a URL e a anon key reais

**Enquanto esses itens não estiverem marcados, o app não funciona** — `index.html` ainda está com os valores de exemplo `SEU-PROJETO.supabase.co` / `SUA_ANON_KEY_PUBLICA` (é só abrir o arquivo e procurar por `SUPABASE_CONFIG` pra confirmar). Siga "Configurar o backend" e "Configurar o frontend" abaixo nessa ordem; depois de configurar, marque os itens acima (e faça commit) para quem futuramente clonar o repositório já saber que essa parte está pronta.

## Estrutura

```
index.html          markup (login, telas e modais)
css/styles.css       estilos
js/                  lógica, dividida por domínio (ver comentários de cada arquivo)
supabase/migration.sql  schema do banco (rodar uma vez no seu projeto Supabase)
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

## O que mudou em relação ao arquivo único original

- **Backend real**: os dados eram salvos com `window.storage` (API exclusiva de artefatos do Claude); agora ficam no Postgres do Supabase, com login obrigatório e Row Level Security.
- **Guias em PDF**: antes ficavam embutidas em base64 dentro do próprio registro; agora vão para o Storage do Supabase (bucket `guias`), e o app pede uma URL assinada para ver/baixar.
- **Removido**: o recurso de "conectar pasta local" / "pastas salvas" (File System Access API + IndexedDB) — era um contorno específico do sandbox do Claude, redundante com um banco de dados de verdade. O botão "Encerrar mês" continua oferecendo salvar os PDFs numa pasta local (quando o navegador permitir) ou baixar um `.zip`, mas exportar/importar backup em `.json` agora é a via principal de backup manual.
- **Tudo o resto** (regras de status, progresso de apuração, formulários, geração de PDF por empresa, exportação Excel, busca de CNPJ) é a mesma lógica do arquivo original, só reorganizada em `js/*.js` por domínio.

## Observação

A função `exportExcel()` (em `js/excel.js`) já existia pronta no arquivo original mas nunca era chamada por nenhum botão — continua assim aqui, disponível mas sem um botão que a acione, exatamente como estava.
