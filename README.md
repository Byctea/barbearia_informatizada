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

## Próximas etapas

PWA instalável e publicação Cloudflare: consulte `docs/fase-9-publicacao.md`. O empacotamento Capacitor para lojas requer definir o domínio HTTPS de produção e validar uma arquitetura mobile compatível com o Next.js SSR e os dados protegidos no D1.
