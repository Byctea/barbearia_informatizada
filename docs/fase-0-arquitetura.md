# Barber Bar — arquitetura inicial

O nome **Barber Bar** é provisório. Alternativas para considerar: **BarberFlow**, **BarberHub** ou **Barbearia Pro**.

## Stack aprovada

- Next.js + React + TypeScript + Tailwind CSS para a interface responsiva/PWA.
- Cloudflare Workers para API e lógica de negócio.
- Cloudflare D1 (SQLite) como banco, com migrations versionadas.
- Recharts para os dashboards; links `wa.me` para contato inicial.
- Capacitor poderá empacotar a PWA para Android/iOS em fase posterior.

O banco é D1, não PostgreSQL. D1 não tem Row Level Security equivalente ao PostgreSQL: a API no Worker verificará identidade, papel e escopo da unidade em todas as operações.

## Fluxo Git e Cloudflare

1. Criar um repositório Git remoto vazio (sem README/licença para evitar conflito inicial) e escolher `main` como branch padrão.
2. Clonar o repositório na pasta de trabalho e abrir essa pasta no editor. O projeto será alterado diretamente nessa cópia local.
3. A cada fase, revisar `git diff`, executar os comandos de validação indicados e fazer um commit local com mensagem descritiva.
4. Você fará o `git push` para o repositório remoto. O Cloudflare Pages poderá acompanhar a branch `main` e publicar cada push; branches/PRs podem gerar previews.
5. Workers e D1 serão configurados para a API e o banco. Migrations serão aplicadas primeiro em ambiente local/preview e depois no banco de produção, com o comando indicado em cada fase.

No início, recomendo manter o projeto em um único repositório. A configuração exata do build/deploy depende do template Next.js escolhido e do adaptador Cloudflare; será entregue e conferida na Fase 9. Não conecte credenciais secretas ao Git: variáveis e segredos ficam nas configurações do Cloudflare.

## Decisões funcionais já registradas

- Fuso da aplicação: `America/Bahia`; armazenar instantes em UTC e converter na interface.
- Agendamento pede aprovação manual do dono.
- Pagamento do agendamento será controlado por status e registros de valor/método, sem integração automática nesta etapa.
- Cancelamento e remarcação terão rastreabilidade. O projeto ainda não impõe política de reembolso ou retenção.
- Cliente avulso não precisa de conta; cliente fidelizado pode ter perfil e autenticação.
- Tabelas de negócio incluem escopo de barbearia/unidade e, quando aplicável, barbeiro para permitir expansão.

## Estrutura prevista

```text
barber-bar/
├── app/                    # rotas e páginas Next.js
├── components/              # componentes compartilhados
├── features/                # módulos de domínio
├── lib/                     # validação, sessão e utilitários
├── workers/                 # API e handlers Cloudflare
├── db/migrations/           # SQL versionado para D1
├── db/seed/                 # dados locais de demonstração
├── public/                  # ícones e manifesto PWA
├── tests/                   # testes
└── wrangler.toml            # configuração Cloudflare
```

## Fases

0. Arquitetura e decisões de stack (aprovada).
1. Modelo de dados, diagrama, migrations D1, índices, estratégia de autorização e seed.
2. Aplicação base, autenticação, layout e perfis.
3. Cadastros de clientes, serviços e produtos.
4. Agenda, disponibilidade e aprovações.
5. Atendimentos, vendas e movimentação de estoque.
6. Financeiro e fluxo de caixa.
7. Fidelidade e acompanhamento de retorno.
8. Dashboards e relatórios.
9. PWA/Capacitor, verificação e publicação guiada.

