# Fase 9 — PWA, segurança de cache e publicação no Cloudflare

## Entregue nesta fase

- Manifesto instalável em português, ícones PNG em 192×192 e 512×512 e ícone maskable.
- Service worker registrado somente em produção. Ele mantém em cache apenas a página genérica offline e ícones; nunca grava APIs, páginas de painel, agendamento, login ou cadastro.
- Cabeçalho `Cache-Control: private, no-store` nas rotas autenticadas e de API para evitar que dados pessoais/financeiros sejam reutilizados pelo cache do navegador.
- Passo a passo de publicação para **Cloudflare Workers com OpenNext e D1**. Este Next.js usa SSR/Route Handlers; não deve ser publicado como site estático no Pages.
- O Capacitor fica planejado para uma etapa posterior: esta aplicação depende de SSR e D1 no Worker, por isso não pode ser exportada como `out` estático. O PWA pode ser instalado em Android e iOS pelo navegador. Antes de gerar um binário Capacitor para loja, será necessário escolher e validar uma arquitetura de aplicativo que consuma o Worker sem expor dados de clientes nem depender de uma URL de desenvolvimento.

## Rodar e validar localmente

Na pasta `barbearia_informatizada` (a pasta que contém `package.json`):

```powershell
npm run dev
```

Acesse `http://localhost:3000`. Em desenvolvimento o service worker não é registrado, para evitar cache durante as alterações.

Validação de produção local:

```powershell
npm run preview
```

Abra o endereço local indicado pelo Wrangler. Em DevTools > Application, confira o manifesto, os três ícones e o service worker. Com a rede desligada, navegar deve mostrar somente a página “Você está sem conexão”; dados de clientes, agenda e financeiro exigem internet e não ficam armazenados offline.

## Preparar Cloudflare sem tocar nos dados existentes

1. No painel Cloudflare, confirme qual conta e qual D1 contêm os clientes válidos. O `database_id` de `wrangler.jsonc` ainda é um marcador zerado; não publique até substituí-lo pelo ID do banco correto. Não crie outro D1 se a base com os clientes já estiver em Cloudflare.
2. Faça uma exportação antes de qualquer mudança. Na pasta do projeto, o comando abaixo grava dados pessoais em um arquivo SQL local; mantenha-o fora do Git e em local protegido:

   ```powershell
   npx wrangler d1 export barber-bar-db --remote --output=backup-d1-producao.sql
   ```

   O `.gitignore` exclui exportações desse tipo. Não envie o arquivo por e-mail/chat nem o adicione ao repositório. A recuperação pontual do D1 pode depender do plano e da janela de Time Travel configurada pela Cloudflare.

3. Se a base válida estiver somente no computador, não aplique o seed demo no remoto. Pare aqui e prepare uma migração de dados com cópia de segurança, preservando IDs e relações; o comando de importação depende de confirmar que essa é a origem correta e de comparar esquema e registros primeiro.
4. Atualize `database_id` com o ID confirmado. Primeiro liste migrations remotas e compare com o histórico esperado; só aplique as pendentes depois da cópia de segurança e da revisão do D1:

   ```powershell
   npx wrangler d1 migrations list barber-bar-db --remote
   npm run db:migrate:remote
   ```

   Não rode reset, `DROP`, seed demo ou comandos contra um banco cuja origem/histórico ainda não foi conferido.
5. Em Workers & Pages, crie/importe um Worker conectado ao repositório privado GitHub `Byctea/barbearia_informatizada`. Defina a pasta raiz como a raiz do repositório (a pasta que contém `package.json`). Configure o build/deploy conforme abaixo:

   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx opennextjs-cloudflare deploy`
   - Variáveis e segredos: configure `BETTER_AUTH_URL` com a URL HTTPS pública e `BETTER_AUTH_SECRET` como secret aleatório forte, com pelo menos 32 caracteres. Nunca grave valores reais em `.env.example`, `.dev.vars` ou Git.

   A alternativa guiada pelo terminal para o primeiro deploy é `npm run deploy`, depois de vincular o D1 correto, configurar os secrets e revisar a migration. O comando publica o Worker; não o execute até confirmar todos esses itens.

6. Faça um deploy de preview com um D1 de staging isolado, valide autenticação, agendamento, cadastro de clientes, atendimentos, vendas e relatórios. Só depois programe o deploy de produção apontando ao banco existente.
7. Após publicar, confira URL HTTPS, cadastro/login, `/api/health`, manifesto e instalação PWA em um celular. Habilite regra Cloudflare de rate limiting/WAF para cadastro e solicitações de agendamento públicos contra spam.

### Dados que já existem

Este projeto não executa migration nem deploy remoto automaticamente. Como você já possui clientes, primeiro confirme se eles estão no D1 local do Wrangler, no D1 remoto da Cloudflare ou em outro banco. A exportação acima é apenas backup; não importa, apaga ou altera os registros. Mantenha o D1 que contém os clientes como fonte de verdade até a migração ser conferida.

### Limitação LGPD conhecida

A exclusão atual do cadastro é lógica (`deleted_at`): dados identificáveis podem permanecer no cadastro e em snapshots de agendamentos. O recurso de apagamento/anonimização completa, com revisão de retenção legal e autenticação associada, deve entrar no backlog de melhorias antes de anunciar atendimento completo a pedidos de exclusão LGPD.

## Commit desta fase

**Resumo:** `Fase 9: preparar PWA e publicação segura no Cloudflare`

**Descrição:** `Adiciona ícones e manifesto PWA, cache offline sem dados privados, política no-store para rotas sensíveis e guia de deploy Worker/D1 com proteção dos dados de clientes.`

## Referências oficiais

- OpenNext no Cloudflare: https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
- Comandos D1 Wrangler/export: https://developers.cloudflare.com/d1/wrangler-commands/
- Exportação e importação D1: https://developers.cloudflare.com/d1/best-practices/import-export-data/
- Backup e Time Travel D1: https://developers.cloudflare.com/d1/reference/time-travel/
- PWA no Next.js: https://nextjs.org/docs/app/guides/progressive-web-apps
