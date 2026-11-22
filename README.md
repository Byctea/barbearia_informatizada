# Barber Bar

Sistema de gestão de barbearia em construção incremental. O nome é provisório.

## Stack prevista

- Next.js + TypeScript + Tailwind CSS para web responsiva/PWA.
- Cloudflare Workers para API e Cloudflare D1 para persistência.
- Wrangler para desenvolvimento local, migrations e publicação.
- Horário de negócio `America/Bahia`; moeda BRL, valores armazenados em centavos.

## Progresso

- Fase 0: arquitetura e fluxo Git/Cloudflare — documentados em `docs/fase-0-arquitetura.md`.
- Fase 1: modelo de dados e migration inicial D1 — `docs/fase-1-modelagem.md` e `db/migrations/0001_initial.sql`.
- Fase 2: base Next.js/Cloudflare, cadastro/login Better Auth e perfis — `docs/fase-2-projeto-base.md`.
- Fase 3: cadastros de clientes, serviços e produtos - `docs/fase-3-cadastros.md`.
- Fase 4: agenda semanal, bloqueios, solicitações e aprovação manual - `docs/fase-4-agenda.md`.
- Fase 5: atendimentos concluídos, vendas, entrada de estoque e alertas de mínimo - `docs/fase-5-atendimentos-vendas-estoque.md`.
- Fase 6: despesas operacionais e fluxo financeiro - `docs/fase-6-financeiro.md`.
- Fase 7: programa de fidelidade, saldos, resgates e retorno de clientes - `docs/fase-7-fidelidade.md`.
- Fase 8: dashboards, relatórios e indicadores por período - `docs/fase-8-relatorios.md`.
- Fase 9: PWA, segurança de cache e publicação guiada em Cloudflare Workers - `docs/fase-9-publicacao.md`.

## Dados de demonstração

`db/seed/0001_demo.sql` deve ser usado somente em um banco local vazio. Não contém credenciais reais.

## Primeira ativação SaaS

- A migration `0007_platform_tenants.sql` adiciona slugs de barbearia, administradores da plataforma e convites de administrador de tenant.
- Antes da ativação, configure `PLATFORM_ADMIN_BOOTSTRAP_TOKEN` com um valor aleatório de pelo menos 24 caracteres em `.dev.vars` (local) e como secret do Worker (produção).
- Crie ou entre na conta que será a proprietária da plataforma e acesse `/master/ativar`. O token pode ativar somente a primeira conta master.
- No painel `/master`, cadastre a barbearia, unidade e e-mail do administrador. Compartilhe o convite gerado; ele expira em 72 horas e é de uso único.
- O login e o cadastro de clientes de cada negócio usam `/b/<slug>/entrar` e `/b/<slug>/cadastro`. O endereço de agendamento é `/b/<slug>/agendar`.
- Para atualizar o banco local: `npm run db:migrate:local`. Para produção: `npm run db:migrate:remote`.

## Próximas etapas

PWA instalável e publicação Cloudflare: consulte `docs/fase-9-publicacao.md`. O empacotamento Capacitor para lojas requer definir o domínio HTTPS de produção e validar uma arquitetura mobile compatível com o Next.js SSR e os dados protegidos no D1.
