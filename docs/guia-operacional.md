# Guia operacional do BarberFlow

**Atualizado em:** 22/11/2026
**Status da loja online:** código implementado localmente; migrations `0009_customer_store.sql` e `0010_customer_membership_requests.sql` e novo deploy ainda pendentes.
**Deploy atual:** manual pelo Wrangler, executado a partir da cópia local do repositório. Push no GitHub, por si só, ainda não publica este Worker.

Este é o guia de referência para entender o funcionamento atual da aplicação, operar os ambientes e publicar alterações. Os documentos `fase-0` a `fase-9` guardam o histórico de decisões e entregas; se uma instrução antiga divergir deste guia, siga este guia.

## 1. Visão geral

BarberFlow é um sistema SaaS de gestão para barbearias. Cada barbearia pode ter uma ou mais unidades e mantém os seus dados isolados dos outros negócios. O proprietário da plataforma cadastra barbearias pelo painel master; cada administrador de barbearia gerencia sua equipe, agenda, clientes, serviços, produtos e operações. Contas novas são clientes por padrão; o cliente encontra barbearias por cidade/UF e solicita vínculo, sujeito à aprovação do administrador. A liberação de conta para barbeiro é feita pelo responsável da plataforma.

A aplicação web usa Next.js com TypeScript, React e Tailwind. O adaptador OpenNext publica o Next.js em Cloudflare Workers. O Cloudflare D1 (SQLite) guarda autenticação e dados de negócio; Better Auth gerencia contas e sessões. O Wrangler cuida das migrations e do deploy.

Configuração confirmada em `wrangler.jsonc`:

- Worker: `barberflow`
- Binding D1: `DB`
- Banco D1: `barber-bar-db`
- URL de produção configurada: `https://barberflow.ecsnote88.workers.dev`
- Fuso de negócio: `America/Bahia`; instantes são armazenados em UTC.
- Valores monetários: inteiros em centavos; apresentação em BRL.

## 2. Contas, papéis e isolamento

- **Administrador da plataforma (master):** ativa uma única conta master com o segredo de bootstrap e cadastra barbearias, unidades e convites. O painel fica em `/master`.
- **Administrador da barbearia:** entra pelo endereço da sua barbearia, acessa somente os dados das unidades autorizadas e opera o painel `/dashboard`.
- **Cliente:** cria conta, busca barbearias por cidade e UF, solicita vínculo, consulta o estado do pedido e, após aprovação, acessa os recursos de cliente da unidade.
- **Barbeiro funcionário/parceiro:** cadastro de profissional usado para equipe, disponibilidade, agenda, bloqueios e escolha no agendamento. O cadastro atual do profissional ainda não cria uma conta de login; quem deseja atuar como barbeiro deve solicitar liberação ao responsável pelo WhatsApp (71) 98226-4690.

As APIs identificam sessão e papel no servidor e consultam o escopo de barbearia/unidade. Não use valores enviados pelo navegador como autoridade para selecionar outro tenant. A conta master é distinta do administrador operacional de uma barbearia.

O token de bootstrap master é de uso único. Segredos reais ficam em `.dev.vars` para desenvolvimento e nos secrets do Worker em produção; nunca os copie para o Git, para este guia ou para `.env.example`.

## 3. Endereços principais

| Área | Caminho |
|---|---|
| Página inicial | `/` |
| Ativação inicial do master | `/master/ativar` |
| Painel master | `/master` |
| Entrar na barbearia | `/b/<slug>/entrar` |
| Cadastro do cliente na barbearia | `/b/<slug>/cadastro` |
| Busca e solicitação de vínculo | `/dashboard/vinculos` |
| Aprovação de vínculos (admin) | `/dashboard/vinculos/solicitacoes` |
| Agendamento do cliente | `/b/<slug>/agendar` |
| Loja do cliente | `/b/<slug>/loja` (aguarda migration e deploy da versão da loja) |
| Painel administrativo | `/dashboard` |
| Equipe/profissionais | `/dashboard/barbeiros` |
| Agenda | `/dashboard/agenda` |
| Pedidos da loja | `/dashboard/pedidos` (aguarda migration e deploy da versão da loja) |
| API de saúde | `/api/health` |

`<slug>` é o endereço curto gerado ao criar a barbearia no painel master. Para contas e dados antigos também há rotas globais de entrada/cadastro/agendamento, mantidas para compatibilidade.

## 4. Funcionalidades

### Master e SaaS

- Ativação inicial da conta master protegida por token secreto configurado no servidor.
- Cadastro de barbearia, unidade principal e e-mail do administrador.
- Convite único de administrador com validade de 72 horas.
- Lista de barbearias, estado ativo/inativo e endereço de acesso.
- Registros legados sem slug são identificados como cadastro antigo, sem inventar um endereço de entrada.

### Equipe e agenda

- Cadastro de barbeiros como funcionários ou parceiros, com nome e telefone opcional.
- Horário semanal configurado individualmente por barbeiro.
- Bloqueios de folga/pausa por profissional; bloqueio conflitante com agendamento ativo é recusado.
- Cliente escolhe um profissional ou deixa a preferência em “Qualquer barbeiro”; os horários mostram o nome do profissional.
- Agendamento requer serviço, data, disponibilidade, nome, telefone e consentimento para tratar os dados do pedido.
- Solicitações são analisadas manualmente pelo administrador. A confirmação do horário e o registro do pagamento também são manuais.
- Padrões: solicitação sem análise expira em 2 horas; pedido aprovado sem pagamento em 24 horas; no máximo 3 agendamentos ativos por cliente/unidade. Prazos podem ser configurados.
- Cliente pode cancelar pedidos não pagos ou pedir remarcação dentro do prazo; pagamento registrado é transferido para a nova data.

### Solicitações de vínculo

- O cliente pesquisa negócios ativos pela cidade e UF registradas no cadastro master.
- O envio cria um pedido `PENDING`; não concede acesso nem papel administrativo.
- O administrador da unidade analisa o pedido em `/dashboard/vinculos/solicitacoes`. Aprovar cria/reativa uma membership `CLIENT` para aquela unidade; recusar registra a decisão sem conceder acesso.
- Profissionais continuam sendo cadastrados pela equipe administrativa. Pedido de conta de barbeiro é tratado com o responsável da plataforma.

### Clientes, serviços e produtos

- Cadastro, edição e inativação de clientes, com consentimento, preferências e histórico.
- Cadastro de serviços com duração, preço e custo estimado.
- Cadastro de produtos com categoria, preço, custo, quantidade, estoque mínimo e foto.
- A foto é selecionada no dispositivo e reduzida no navegador para WebP; a representação é armazenada no campo `products.image_url` do D1. O campo é opcional e limitado a 350.000 caracteres após redução.
- Produtos inativos ou com saldo zero não aparecem como disponíveis na loja.

### Loja online — implementação local ainda não publicada

- Cliente autenticado abre a loja da própria barbearia, vê foto, preço e quantidade disponível e monta um carrinho.
- Envio cria um pedido pendente de retirada; a barbearia confirma disponibilidade e combina pagamento/retirada pelo WhatsApp.
- O banco reserva o estoque ao gravar os itens do pedido. A operação usa triggers D1 para verificar saldo, baixar estoque e registrar movimentação.
- Se o administrador cancelar o pedido, as quantidades são devolvidas ao estoque e uma movimentação de retorno é registrada.
- Ao marcar o pedido como concluído, é criado um lançamento de receita de produto no Financeiro.
- Esta versão não processa pagamento online nem calcula entrega. A forma de pagamento é combinada diretamente com a barbearia.
- Interface do administrador: `/dashboard/pedidos`. O cliente também vê o estado dos seus pedidos na loja.

### Atendimentos, estoque e financeiro

- Concluir agendamento confirmado cria histórico do atendimento e registra receita do serviço.
- Atendimento avulso permite selecionar barbeiro, cliente opcional e um ou mais serviços.
- Venda administrativa registra cliente opcional, itens, preços, forma de pagamento, receita e baixa de estoque.
- Compra repõe saldo, atualiza custo unitário e registra despesa de aquisição.
- Alertas aparecem quando o saldo alcança ou fica abaixo do estoque mínimo.
- Financeiro reúne receitas/despesas confirmadas, despesas operacionais e saldo por período. O pagamento é conferido manualmente.

### Fidelidade e relatórios

- Programa por visitas ou por pontos, com recompensa definida pelo administrador.
- Atendimento concluído credita visitas/pontos; venda de produto credita pontos quando o cliente participa.
- Resgate consome saldo e mantém livro-razão de movimentações.
- Relatórios oferecem filtros de período, receita, despesa, resultado líquido, ticket médio, rankings de clientes/serviços/produtos, margem e retorno.
- Lembretes de retorno abrem o WhatsApp com texto preenchido; o envio é manual.

### PWA e carregamento

- Aplicação instalável pelo navegador, com manifesto e ícones.
- Service worker só mantém a página offline genérica e ícones. Dados de conta, agenda, clientes e financeiro não são guardados para uso offline.
- Uma folha 4×4 do barbeiro fica em `public/barber-sprite.svg`. O indicador global acompanha somente chamadas `/api/*` do próprio app e navegação entre telas. Há limite visual de 12 segundos por chamada e de 7 segundos por navegação; mudança de rota e botão Voltar também limpam o overlay para evitar carregamento preso. A animação respeita a preferência de movimento reduzido do dispositivo.

## Página pública e identidade

A marca pública é Barber Flow. A página inicial apresenta os dez módulos operacionais, sem o painel master, que é interno. Os cartões de 1.000 agendamentos, 500 clientes e R$ 230 mil são demonstrativos; o WhatsApp de orçamento é (71) 98226-4690. O mascote atual do código está em `public/barber-sprite.svg`; o usuário indicou uma folha PNG 4×4 própria para o loader, que ainda precisa ser copiada para `public/` e conectada ao componente.

O registro de continuidade das etapas está em `docs/continuidade.md`.

## 5. Estrutura importante do repositório

```text
src/app/                  rotas Next.js, páginas e Route Handlers
src/components/           interfaces reutilizáveis
src/lib/                  autenticação, escopos, agenda e regras compartilhadas
db/migrations/            migrations SQL versionadas do D1
db/seed/                  dados demonstrativos; somente banco local vazio
public/                   manifesto, ícones e assets, incluindo a folha do barbeiro
wrangler.jsonc            Worker, binding D1, assets e URL Better Auth
.dev.vars                 secrets locais, ignorado pelo Git
```

Arquivos de referência para áreas principais:

- `src/lib/admin-scope.ts`: autenticação do administrador e escopo da unidade.
- `src/lib/booking.ts`: regras e cálculo de disponibilidade da agenda.
- `src/app/api/appointments/route.ts`: leitura de disponibilidade, agendamento e loja do cliente.
- `src/app/api/admin/operations/route.ts`: atendimentos, vendas e entradas de estoque.
- `src/app/api/admin/store-orders/route.ts`: pedidos de loja (versão ainda não publicada).
- `src/lib/admin-records.ts`: validação e definição dos cadastros administrativos.
- `src/components/global-action-loader.tsx`: indicador de carregamento compartilhado.

## 6. Banco e migrations

Migrations versionadas em `db/migrations/`:

| Migration | Conteúdo |
|---|---|
| `0001_initial.sql` | Barbearias, unidades, usuários e tabelas operacionais iniciais |
| `0002_auth.sql` | Esquema Better Auth |
| `0003_auth_account_issuer_nullable.sql` | Ajuste de contas de autenticação |
| `0004_booking_settings.sql` | Regras configuráveis da agenda |
| `0005_sales_inventory.sql` | Validações transacionais de estoque e índices |
| `0006_loyalty_integrity.sql` | Fidelidade e prevenção de créditos duplicados |
| `0007_platform_tenants.sql` | Slugs, administradores master e convites SaaS |
| `0008_barber_relationship_type.sql` | Vínculo funcionário/parceiro |
| `0009_customer_store.sql` | Foto do produto, pedidos de loja, triggers de estoque e vínculo financeiro |

Pelo histórico deste projeto, as migrations até `0008` foram aplicadas no D1 remoto. A `0009` está no código local e ainda deve ser aplicada antes de publicar as telas de loja. Sempre confira a lista e o banco de destino antes de executar migrations remotas.

Comandos disponíveis (PowerShell na pasta que contém `package.json`):

```powershell
npm install
npm run dev
npm run db:migrate:local
npm run db:seed:local       # somente D1 local vazio
npm run db:migrate:remote   # aplica migrations pendentes no D1 configurado
npm run preview             # build e preview local do Worker
npm run deploy              # build OpenNext e publica Worker via Wrangler
npm exec tsc -- --noEmit
```

O `database_id` no `wrangler.jsonc` aponta para o D1 de produção. Não altere o ID nem rode seed remoto sem confirmar a origem e ter backup. `.dev.vars`, `.env.local`, `.next`, `.open-next`, `.wrangler`, 
ode_modules` e backups de banco não devem ser commitados.

Secrets necessários variam por ambiente. O exemplo `.env.example` contém nomes/valores de exemplo, não credenciais reais. Para produção, confira no painel do Worker `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` e, para instalação inicial do master, o `PLATFORM_ADMIN_BOOTSTRAP_TOKEN`. A URL pública atual configurada é `https://barberflow.ecsnote88.workers.dev`.

## 7. Fluxo atual de Git e Cloudflare

**Hoje:** o deploy é manual pelo Wrangler a partir da cópia local. 
pm run deploy` constrói o Worker e publica diretamente na Cloudflare. Commit ou push no GitHub não foi configurado para publicar este Worker automaticamente. O histórico recente de deployments no painel Cloudflare identifica publicação manual via Wrangler.

Fluxo recomendado para esta loja online:

1. Revise e faça commit das alterações no GitHub Desktop; envie **Push origin** para manter a cópia remota atualizada.
2. Confirme que `wrangler.jsonc` aponta para o D1 de produção correto e, se possível, faça backup antes de alterar o esquema.
3. Execute 
pm run db:migrate:remote`; confira que a `0009_customer_store.sql` foi aplicada com sucesso.
4. Execute 
pm run deploy` e espere o Wrangler indicar sucesso/URL publicada.
5. No painel Cloudflare, confirme a implantação como **Pronto**; abra `/api/health`.
6. Teste login do cliente, cadastro de foto e produto com estoque > 0, pedido na loja e transições no painel do administrador. Confirme estoque após pedido/cancelamento e o lançamento financeiro ao concluir.

O push antes do deploy mantém GitHub e o código implantado alinhados, mas a publicação continua sendo iniciada pelo comando manual.

### Conectar deploy automático pelo Git — planejado

Quando quiser trocar o fluxo, conecte o repositório `Byctea/barbearia_informatizada` ao Worker `barberflow` nas configurações de Builds/Deploy do Cloudflare. Use a raiz do projeto, branch `main`, build 
px opennextjs-cloudflare build` e deploy 
px opennextjs-cloudflare deploy`; confirme bindings D1, assets e secrets na configuração do Worker. Faça uma implantação de teste antes de depender do fluxo.

A conexão do Git não deve aplicar migrations de produção automaticamente por padrão. Mantenha 
pm run db:migrate:remote` como etapa manual/revisada até criar um processo de migration com backup e validação. Nesse fluxo futuro, push aprovado publica o código, mas uma migration nova precisa estar aplicada no D1 antes do Worker executar consultas que dependam dela.

## 8. Pendências e limites conhecidos

- Aplicar remotamente a migration `0009_customer_store.sql` e publicar o código da loja.
- Build local no ambiente de assistência encontrou bloqueio de sandbox ao abrir conexão localhost (`EACCES`); TypeScript passou. Execute 
pm run deploy` na máquina de desenvolvimento e confira o resultado do Wrangler.
- Deploy automático pelo Git ainda não está conectado ao Worker BarberFlow.
- Pagamento da agenda e da loja é manual; não há gateway, cálculo de entrega ou envio automático de WhatsApp/e-mail.
- O cadastro de barbeiro ainda não cria credenciais/login individual.
- O apagamento LGPD hoje é lógico para cliente; política de retenção e anonimização integral de snapshots/histórico precisa de revisão antes de prometer exclusão completa.
- Teste com banco/conta de desenvolvimento antes de anunciar a loja a clientes; para produção, mantenha backup e nunca use o seed demonstrativo.

## 9. Modelo de commit para a entrega da loja

**Resumo:** `Adiciona loja online e carregamento animado`

**Descrição:** `Permite cadastrar produtos com foto, exibir a loja aos clientes, receber pedidos com controle transacional de estoque e acompanhar os status no painel. Registra a receita ao concluir o pedido e adiciona o indicador animado do barbeiro durante requisições e navegação.`
