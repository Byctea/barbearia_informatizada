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
- A identidade visual usa `public/barber-portrait.png` como retrato estático da apresentação e `public/barber-sprite.png` (folha pixel art 4×4) no loader; o loader anima os quatro quadros da primeira linha.

### Alterações feitas nesta etapa
- Página inicial reescrita com marca Barber Flow, mascote, indicadores demonstrativos, descrição dos módulos e CTA de orçamento por WhatsApp.
- Cadastro público explica o papel inicial de cliente e como solicitar liberação para trabalho como barbeiro.
- Loader e mascote ajustados: sprite pixel art 4×4 no carregamento e retrato do barbeiro na apresentação.
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
2. Confirmar as migrations locais e revisar comportamento da aprovação, em especial a associação à unidade correta. A falha anterior do Wrangler ocorreu apenas no ambiente de assistência; o usuário confirmou que aplicou a migration e fez o deploy.
3. Atualizar este guia operacional e registrar estado final após verificação. **Concluído:** guia operacional atualizado.
4. **Concluído conforme informado pelo usuário:** migration aplicada e deploy realizado.

## Estado anterior do projeto
O guia operacional deste documento fica em `docs/guia-operacional.md`. O projeto usa Next.js, Better Auth e Cloudflare D1; deployments são manuais pelo Wrangler. Consulte o guia para ambientes, migrations pendentes e operação de produção.

## Continuação solicitada — vitrine, agendamento e carregamento

### Decisões e alterações
- O módulo interno “Painel da plataforma” foi retirado da vitrine pública. A descrição de Visão geral agora fala da gestão da barbearia. Os três indicadores demonstrativos solicitados originalmente permanecem.
- No painel do cliente foi removido o botão genérico “Agendar ou consultar meus horários”.
- Na busca regional, cada resultado tem “Escolher barbearia”; essa escolha revela “Ver horários e agendar”, apontando para `/b/<slug>/agendar`. A solicitação opcional de vínculo permanece dentro da barbearia escolhida.
- Corrigido o loader infinito ao voltar/desistir de cadastro ou agendamento: `fetch` monitora somente `/api/*` do próprio app, chamadas têm watchdog visual de 12 segundos, navegação tem timeout de 7 segundos e `popstate`/mudança de rota limpam o overlay.
- Ajustada a animação CSS para avançar quatro quadros da primeira linha da folha pixel art PNG.
- Adicionadas as duas artes fornecidas: sprite pixel art no loader e retrato do barbeiro na vitrine.

### Arquivos alterados nesta continuação
- `src/app/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/components/customer-barbershops.tsx`
- `src/components/global-action-loader.tsx`
- `src/app/globals.css`
- `public/barber-sprite.png`, `public/barber-portrait.png`
- `docs/guia-operacional.md`

### Estado da arte do loader
A folha pixel art enviada foi integrada em `public/barber-sprite.png`; o loader mostra os quatro quadros da primeira linha. O retrato enviado está em `public/barber-portrait.png` e é usado na vitrine. CSS referencia ambos.

### Próximos passos
1. A arte PNG foi adicionada e ligada via CSS. `npx tsc --noEmit` e `git diff --check` passaram neste checkout.
2. Migration `0010_customer_membership_requests.sql` aplicada e deploy feito, conforme confirmação do usuário em 22/11/2026. A conferência da URL publicada pelo ambiente de assistência não foi possível porque a resolução DNS falhou.
3. Revisar no navegador o carregamento e os fluxos de voltar/cancelar na versão publicada.

**GitHub Desktop - Resumo:** Atualiza vitrine, agendamento e identidade do Barber Flow

**GitHub Desktop - Descrição:** Atualiza a vitrine Barber Flow com módulos, indicadores demonstrativos, contato de orçamento e retrato do barbeiro. Usa a spritesheet pixel art 4×4 no carregamento. Adiciona busca regional de barbearias, solicitações de vínculo com aprovação e agendamento após escolher a barbearia. Corrige o loader preso ao voltar do cadastro ou desistir do agendamento. Migration 0010 e deploy remoto concluídos conforme informado pelo usuário em 22/11/2026.

## Requisito adicional — barbearias vinculadas e busca por nome

- Confirmado com o usuário: cliente sem vínculos ativos continua vendo a busca e pode solicitar aceitação; cliente com vínculo vê as barbearias associadas no dashboard; quando há mais de uma, pode escolher em qual abrir o agendamento e ainda encontrar outra.
- Busca agora aceita nome da barbearia e filtros opcionais de cidade/UF.
- API de vínculos pode retornar, além das solicitações, barbearias ativas do cliente. Dashboard e tela de vínculos listam essas barbearias.
- Arquivos alterados: `src/app/api/public/barbershops/route.ts`, `src/app/api/customer/membership-requests/route.ts`, `src/app/dashboard/page.tsx`, `src/components/customer-barbershops.tsx`.
- `npx tsc --noEmit` e `git diff --check` passaram após as alterações. O usuário confirmou que aplicou a migration e publicou o deploy.
- Atualizar o resumo/descrição de commit no GitHub Desktop para incluir a lista de barbearias vinculadas e a busca por nome/região.

## Continuação solicitada - compra de produtos e baixa de pagamento

- A loja do cliente mantém catálogo e carrinho e agora separa pedido/retirada de pagamento. Enquanto o barbeiro não registrar o recebimento, cliente e barbeiro veem a compra em pendências; ambas as telas atualizam a lista a cada 30 segundos.
- No painel do barbeiro, a baixa registra a receita no financeiro e o pedido só pode ser concluído depois do pagamento recebido. Pedidos cancelados seguem devolvendo as unidades ao estoque.
- Relatórios ganhou consulta individual das compras do cliente, com totais pendentes e pagos, imprimível ou salvável em PDF pelo navegador.
- Telefone do agendamento já era obrigatório no formulário e validado novamente pela API; a regra foi mantida.
- Migration nova: `0011_store_order_payment.sql`. Ainda precisa ser aplicada remotamente e o Worker atualizado antes de usar estas alterações em produção.

## Continuidade solicitada - painel master e central do cliente

- No painel `/master`, a lista de barbearias tem ações por ícone para editar e excluir. A edição ajusta nome, unidade principal, cidade, UF e status. Exclusão remove somente cadastros sem dados comerciais; com histórico ou usuários clientes, desativa o negócio e preserva os dados, permitindo reativação na edição.
- O painel do cliente em `/dashboard` centraliza vínculos pendentes/aprovados/recusados, solicitações de agendamento, compras, situação de pagamento e acesso à loja/agenda. A busca e a solicitação de vínculo também podem ser feitas nessa tela.
- Nova API `GET /api/customer/activity` consolida atividades do cliente em todas as barbearias, inclusive onde ele ainda não tem vínculo ativo. A central atualiza a cada 30 segundos.
- Aplicação posterior à migration 0011 e deploy ainda pendentes para publicar as alterações recentes.
