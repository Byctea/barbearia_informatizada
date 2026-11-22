# Continuidade do projeto Barber Flow

**Atualizado em:** 22/11/2026
**Projeto:** Barbearia Informatizada (`barbearia_informatizada`)

## Etapa em andamento — nome, página pública e vínculos de clientes

### Decisões
- O nome público do produto é **Barber Flow**.
- Contas abertas continuam com papel `CLIENT`; o usuário não pode escolher nem elevar o próprio papel.
- Cliente pode buscar barbearias por cidade e UF e enviar solicitação de vínculo.
- A solicitação só cria membership `CLIENT` depois de aprovação por administrador ativo da mesma barbearia e unidade.
- Solicitações para atuar como barbeiro são encaminhadas ao responsável pelo WhatsApp **(71) 98226-4690**. O fluxo atual ainda não cria login para barbeiro.
- Os números 1.000 agendamentos, 500 clientes e R$ 230 mil de receita na página pública são demonstrativos, não métricas consultadas do banco.
- A figurinha disponível em `public/barber-sprite.svg` é uma folha 4×4; loader e mascote devem percorrer os quatro quadros da primeira linha.

### Alterações feitas nesta etapa
- Página inicial reescrita com marca Barber Flow, mascote, indicadores demonstrativos, descrição dos módulos e CTA de orçamento por WhatsApp.
- Cadastro público explica o papel inicial de cliente e como solicitar liberação para trabalho como barbeiro.
- Loader e mascote ajustados para usar spritesheet 4×4 e animação horizontal dos quadros.
- Manifesto PWA e texto da tela de entrada atualizados para Barber Flow.
- Migration `0010_customer_membership_requests.sql` adiciona cidade/UF em barbearias e unidades e tabela de solicitações de vínculo.
- API pública lista barbearias por cidade/UF; API autenticada registra e lista solicitações do cliente.
- API administrativa lista, aprova ou recusa pedidos, restrita ao escopo administrativo ativo.
- Criadas telas `/dashboard/vinculos` para cliente e `/dashboard/vinculos/solicitacoes` para administrador.
- Cadastro de barbearias no painel master passou a exigir cidade e UF.

### Arquivos envolvidos
- `src/app/page.tsx`, `src/app/globals.css`, `src/components/global-action-loader.tsx`
- `src/app/cadastro/page.tsx`, `src/app/entrar/page.tsx`, `src/app/manifest.ts`
- `db/migrations/0010_customer_membership_requests.sql`
- `src/app/api/public/barbershops/route.ts`
- `src/app/api/customer/membership-requests/route.ts`
- `src/app/api/admin/membership-requests/route.ts`
- `src/components/customer-barbershops.tsx`, `src/components/admin-membership-requests.tsx`
- `src/app/dashboard/vinculos/page.tsx`, `src/app/dashboard/vinculos/solicitacoes/page.tsx`
- `src/app/dashboard/page.tsx`, `src/app/api/master/barbershops/route.ts`, `src/components/master-dashboard.tsx`

### Próximos passos
1. Rodar `npx tsc --noEmit` e corrigir erros de tipagem/compilação. **Concluído:** TypeScript passou.
2. Confirmar as migrations locais e revisar comportamento da aprovação, em especial a associação à unidade correta. **Pendente:** `npm run db:migrate:local` não concluiu: Wrangler recebeu `EPERM` ao gravar log fora do workspace e falhou a conexão; a migration não foi aplicada.
3. Atualizar este guia operacional e registrar estado final após verificação. **Concluído:** guia operacional atualizado.
4. Aplicar migration 0010 e publicar só quando solicitado/previsto pelo fluxo do projeto; deployment continua manual pelo Wrangler.

## Estado anterior do projeto
O guia operacional deste documento fica em `docs/guia-operacional.md`. O projeto usa Next.js, Better Auth e Cloudflare D1; deployments são manuais pelo Wrangler. Consulte o guia para ambientes, migrations pendentes e operação de produção.
