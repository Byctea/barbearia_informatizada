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

## Dados de demonstração

`db/seed/0001_demo.sql` deve ser usado somente em um banco local vazio. Não contém credenciais reais.

## Próximas etapas

Na Fase 2 será criado o esqueleto executável Next.js/Workers, configuração Wrangler e autenticação. O projeto ainda não está pronto para deploy.
