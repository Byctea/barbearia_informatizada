# Fase 6 — Financeiro

## Entregue

- A página administrativa `/dashboard/financeiro` apresenta o fluxo financeiro por intervalo de datas.
- Receitas de serviços e vendas, e custos de compras de produtos, vêm dos registros criados nas fases anteriores.
- Despesas operacionais podem ser registradas em aluguel, energia, água, internet, equipamentos ou outros, com valor, data, pagamento e observações.
- Uma série mensal opcional cria 12 ocorrências. A primeira já vencida é confirmada; ocorrências com data futura ficam pendentes e só entram no saldo após confirmação. Uma despesa ainda não paga pode ser cancelada.
- O saldo considera apenas lançamentos confirmados: receitas menos despesas. Lançamentos vinculados a atendimento, venda ou compra não são alteráveis nesta tela.
- Acesso e consultas ficam limitados à barbearia e unidade do administrador autenticado.

## Banco e operação

Não foi necessária migração: a tabela `finance_entries` já foi criada na Fase 1 e recebe lançamentos das fases anteriores. A aplicação deve seguir usando as migrações já aplicadas no banco local. Não aplique comandos remotos nesta fase.

## Como validar localmente

1. Execute `npm run dev` na pasta do projeto e entre com a conta de administrador.
2. Abra Painel → Financeiro. Confira receitas de atendimentos, vendas e compras no período do mês atual.
3. Registre uma despesa avulsa e confira os totais e o lançamento.
4. Registre uma despesa mensal com data futura; ela deve aparecer como pendente. Use “Confirmar pagamento” e confira o saldo. Teste também “Cancelar”.
5. Altere o intervalo para conferir os lançamentos de outra data.

## Verificação de código

- `node .\\node_modules\\typescript\\bin\\tsc --noEmit --pretty false`
- `git diff --check`
