# Fase 4 — Agenda e agendamentos

## O que foi entregue

- Expediente semanal por barbeiro, com dias fechados e intervalos de trabalho.
- Bloqueios pontuais para folgas e pausas; não permite bloquear um horário que já tenha agendamento ativo.
- Consulta de serviços e horários livres considerando duração, expediente, bloqueios e conflitos existentes, no fuso `America/Bahia`.
- Solicitação pelo cliente autenticado, com nome, telefone e consentimento LGPD.
- Aprovação ou recusa manual pelo proprietário. Aprovar libera a cobrança; o agendamento só fica confirmado depois de o proprietário conferir e registrar o pagamento.
- Registro manual da forma do pagamento. As colunas de provedor permanecem preparadas, sem integração nem credenciais de gateway nesta fase.
- Consulta do cliente aos próprios agendamentos, cancelamento dentro do prazo e remarcação com transferência do pagamento já registrado.
- Regras por unidade: intervalo dos horários, antecedência mínima de cancelamento/remarcação e horizonte de agendamento.
- Proteções contra horários concorrentes, solicitações simultâneas e ocupação excessiva da agenda por uma única conta.

## Regras iniciais

- A confirmação automática fica desativada.
- Uma solicitação sem análise expira após 2 horas e libera o horário.
- Um pedido aprovado, mas sem pagamento confirmado, expira em 24 horas.
- Cada conta pode manter até 3 agendamentos ativos por unidade.
- Pagamento já registrado não pode ser cancelado pelo cliente; a opção é solicitar remarcação, que transfere o registro de pagamento para a nova data.
- O cancelamento e a remarcação respeitam o prazo mínimo configurado (24 horas por padrão).
- Serviços com valor zero podem ser confirmados após análise manual, sem criar lançamento de pagamento.

## Migration local

Esta fase adiciona `db/migrations/0004_booking_settings.sql`. No CMD, dentro da pasta `barbearia_informatizada`, execute:

```bat
npm run db:migrate:local
```

Quando o Wrangler pedir confirmação, responda `y`. Aplique apenas ao D1 local; não use `--remote`. Não é necessário rodar a seed novamente. Reinicie `npm run dev` depois da migration.

## Como conferir

1. Entre com a conta ADMIN e abra **Agenda** no painel.
2. Configure expediente para pelo menos um dia e salve. Ajuste o intervalo, prazo mínimo e horizonte da agenda.
3. Crie um bloqueio futuro e confira que ele aparece na lista; tente um bloqueio que atravesse um agendamento ativo para confirmar que a API recusa.
4. Em uma segunda conta CLIENTE, abra `/agendar`, selecione serviço, dia e horário disponível, informe telefone e aceite o uso dos dados.
5. Na conta ADMIN, abra a data e aprove a solicitação. Ela deve passar para **Aguardando pagamento**.
6. Registre a forma de pagamento conferida; o estado deve mudar para **Confirmado**.
7. Na conta CLIENTE, confira o agendamento. Teste cancelar um pedido ainda não pago e remarcar um confirmado dentro do prazo mínimo.
8. Confira que dois clientes não conseguem reservar o mesmo barbeiro e horário e que a conta não cria mais de três agendamentos ativos.
9. Teste `/dashboard/agenda` e as APIs em uma conta CLIENTE; o acesso administrativo deve ser negado.

## Limites desta fase

O proprietário ainda comunica instruções de pagamento manualmente (o cliente pode usar o contato WhatsApp exibido). A API do WhatsApp, e-mail e gateway serão integrados em etapa posterior. No lançamento público, adicionar proteção de tráfego e abuso, como rate limiting no Cloudflare, além dos limites de domínio já implementados.
