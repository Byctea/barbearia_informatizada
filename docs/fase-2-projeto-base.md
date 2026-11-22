# Fase 2 — projeto base, sessão e perfis

## Entregue

- Next.js App Router + TypeScript + Tailwind CSS 4.
- Adaptador OpenNext para executar Next.js em Cloudflare Workers.
- Binding D1 `DB` no Wrangler.
- Better Auth com senha e sessão persistida no D1. O cadastro público cria apenas o papel `CLIENT`; o formulário nunca envia papel administrativo.
- Perfil inicial `/dashboard` protegido no servidor, página de entrada, cadastro e saída.
- Rota de verificação `GET /api/health` e manifesto PWA básico.
- Migrations `0002_auth.sql` e `0003_auth_account_issuer_nullable.sql`, com o esquema Better Auth e ajuste para cadastro de credenciais por e-mail/senha.

## Preparar no Windows

Use PowerShell, dentro da raiz do clone (`barbearia_informatizada`):

```powershell
npm install
Copy-Item .env.example .dev.vars
```

Abra `.dev.vars` e substitua o valor de `BETTER_AUTH_SECRET` por uma chave aleatória de pelo menos 32 caracteres. A `.dev.vars` está ignorada pelo Git. Não publique esse segredo nem o coloque em `.env.example`.

## Criar e migrar o D1 local

O `wrangler.jsonc` contém um UUID zerado como identificador temporário. Ele permite manter um exemplo válido no clone; substitua pelo `database_id` verdadeiro antes de conectar qualquer banco remoto.

Para criar o banco na sua conta Cloudflare e associar este projeto:

```powershell
npx wrangler login
npx wrangler d1 create barber-bar-db
```

O Wrangler imprimirá o `database_id`. Copie-o para `database_id` em `wrangler.jsonc`; depois, adicione a alteração ao Git. O nome `barber-bar-db` deve continuar igual ao `database_name` e ao binding do arquivo.

Para um banco local de desenvolvimento, aplique as migrations e os dados de exemplo:

```powershell
npm run db:migrate:local
npm run db:seed:local
```

O seed é exclusivamente de demonstração. Não rode em produção.

## Promover a conta do proprietário a ADMIN

1. Inicie a aplicação e crie uma conta usando `/cadastro`.
2. Em um banco local de desenvolvimento, confira o e-mail cadastrado e promova essa conta pelo Wrangler:

```powershell
npx wrangler d1 execute barber-bar-db --local --command "UPDATE user SET role = 'ADMIN' WHERE email = 'seu-email@exemplo.com';"
```

O papel ADMIN não é selecionável no cadastro. Para o banco remoto, somente depois de confirmar o D1 certo e revisar o e-mail, execute o mesmo `UPDATE` trocando `--local` por `--remote`. Evite compartilhar credenciais ou fazer esse comando em banco que não seja o do Barber Bar.

## Executar e conferir no navegador

```powershell
npm run dev
```

Abra `http://localhost:3000` e confira a página inicial. Use `Criar conta`, finalize o cadastro e verifique se `/dashboard` mostra a área do cliente. Saia, entre novamente e confira a persistência da sessão. Depois promova uma conta local a ADMIN e entre outra vez para ver o painel do proprietário. A rota `http://localhost:3000/api/health` deve responder JSON com `status: "ok"`.

Para verificar o mesmo runtime usado no Workers, depois de cadastrar o ID D1:

```powershell
npm run preview
```

O comando build/preview usa o Worker local do Wrangler; não publica nada. O deploy remoto fica para uma etapa posterior após validar a aplicação e as secrets.

## Git e Cloudflare

No GitHub Desktop, faça o commit desta entrega como `Fase 2: base Next.js, D1 e autenticação`. Depois envie o push. Ainda não conectamos o GitHub ao deploy automático: primeiro vamos validar o preview e decidir a configuração final de produção. Na etapa de publicação, configuraremos secrets no Cloudflare, D1 remoto, aplicação e integração Git/preview com instruções visuais.

## Limites desta fase

- Cadastro não pede confirmação por e-mail; envio de e-mail e recuperação de senha precisam de um provedor de e-mail configurado antes de produção.
- Administração é concedida manualmente. A autorização de acesso por unidade e os cadastros de barbeiro/unidade serão implementados nos módulos seguintes.
- Não coloque o sistema em produção com contas reais antes de configurar envio/validação de e-mail, secrets e regras completas de acesso do domínio.

