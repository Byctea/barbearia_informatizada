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

## Estado atual e operação

Este documento registra a entrega original de PWA e orientações de publicação. O procedimento vigente foi consolidado em [`docs/guia-operacional.md`](guia-operacional.md).

O Worker `barberflow` já está publicado em `https://barberflow.ecsnote88.workers.dev`, com D1 remoto configurado em `wrangler.jsonc`. Atualmente a publicação é manual via `npm run deploy`; o GitHub não dispara o deploy deste Worker. A migration 0009 da loja está pendente no remoto conforme o estado registrado no guia. Não use o antigo ID de exemplo nem replique passos antigos sem conferir o ID e o histórico atuais.

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
