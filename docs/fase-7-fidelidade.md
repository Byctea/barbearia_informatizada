# Fase 7 — Fidelidade e retorno

## Entregue

- Administração de programa por atendimentos ou pontos por R$ gasto, com recompensa configurável.
- Os saldos começam com eventos registrados enquanto o cliente está no programa; não há crédito retroativo de atendimentos ou vendas anteriores.
- Créditos automáticos para clientes participantes: atendimento concluído gera crédito de atendimento ou pontos; venda de produtos gera pontos.
- Resgate consome o saldo exigido e cria movimentação no livro-razão. Créditos de visitas e vendas têm vínculo único para impedir duplicidade.
- Painel de clientes em dia, atrasados ou inativos, com último atendimento e dias decorridos.
- Intervalo ideal configurável por cliente (30 dias quando não definido); clientes sem corte ou há 90 dias sem retornar são marcados como inativos.
- Lembrete abre o WhatsApp com mensagem preenchida; o envio permanece manual.
- Endpoints autenticados e limitados à barbearia e unidade do administrador.

## Banco local

A migração `0006_loyalty_integrity.sql` adiciona o campo que liga pontos a vendas, define o limite de um programa ativo por unidade e impede créditos duplicados por evento. Aplique **somente no banco local**:

```powershell
npm run db:migrate:local
```

A migração é aditiva. Não execute `db:migrate:remote` nesta fase.

## Como validar

1. Inicie o app com `npm run dev` e entre como administrador.
2. Abra **Fidelidade** no painel e salve uma regra de 10 atendimentos para uma recompensa.
3. Ative um cliente no programa; conclua um atendimento desse cliente e confirme o saldo.
4. Com saldo suficiente, resgate a recompensa e confira o saldo reduzido.
5. Altere a regra para pontos, salve e teste uma venda para cliente participante.
6. Configure um intervalo menor que o tempo desde o último atendimento e confira o status; teste o lembrete WhatsApp.

## Checagem de código

```powershell
node .\node_modules\typescript\bin\tsc --noEmit --pretty false
git diff --check
```
