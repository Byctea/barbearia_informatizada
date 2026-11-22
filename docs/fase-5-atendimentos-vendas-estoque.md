# Fase 5 - Atendimentos, vendas e estoque

## Entregue

- Conclusão de agendamento confirmado, gerando atendimento e cópia histórica do serviço/preço/custo.
- Registro de atendimento sem agendamento, com cliente opcional e múltiplos serviços.
- Venda de produtos vinculada opcionalmente a cliente, com preço/custo copiados do cadastro, forma de pagamento, itens e baixa de estoque.
- Entrada de compra no estoque, incluindo custo unitário atualizado, fornecedor opcional e lançamento do custo para a Fase 6.
- Alertas de produto com quantidade igual ou inferior ao mínimo e lista de atividades recentes.
- Toda operação grava seus registros relacionados em lote no D1. Trigger impede venda de produto inativo ou sem saldo e aborta a transação.
- Consultas e gravações limitadas ao escopo ADMIN da unidade ativa.

## Migration local

No CMD, na pasta `barbearia_informatizada`, execute:

```bat
npm run db:migrate:local
```

Confirme com `y` quando solicitado. A migration `0005_sales_inventory.sql` cria a proteção transacional de estoque e índices. Aplique somente ao D1 local; não use `--remote`. Reinicie `npm run dev` apó a migration.

## Validação manual

1. Entre como ADMIN e abra **Atendimentos e vendas** no painel.
2. Conclua um agendamento confirmado e confira que ele sai da lista, aparece no histórico e registra receita de serviço.
3. Registre atendimento sem agendamento, como cliente avulso e como cliente cadastrado, com um ou mais serviços.
4. Registre uma venda com mais de um produto; confira total, pagamento, venda recente, movimentação e quantidade atualizada.
5. Tente vender quantidade superior ao saldo. Deve receber alerta e o estoque/venda devem permanecer sem alteração.
6. Registre uma compra e confira aumento de saldo, custo atual do produto, fornecedor e compra recente.
7. Confira o alerta quando o estoque ficar igual ou abaixo do mínimo.
8. Tente acessar `/dashboard/operacoes` e `/api/admin/operations` com conta CLIENTE; deve ser negado.

## Limites

O pagamento de vendas e serviços é registrado como conferido manualmente, sem gateway. O lançamento financeiro fica armazenado para a próxima fase; relatórios e fluxo de caixa serão construídos na Fase 6. A entrada de compra define o custo atual do produto como o custo da aquisição mais recente; o custo histórico de cada venda fica congelado no item.
