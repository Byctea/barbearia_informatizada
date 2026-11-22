# Fase 8 — Dashboards e relatórios

## Entregue

- Painel `/dashboard/relatorios` com filtros por hoje, semana, mês, ano e datas personalizadas.
- Indicadores de receita de serviços e produtos, despesas confirmadas, resultado líquido e ticket médio.
- Evolução temporal de receita e despesas; períodos maiores que 62 dias são agrupados por mês.
- Rankings de clientes atendidos, serviços mais realizados, produtos mais vendidos e produtos de maior margem.
- Taxa de retorno: clientes atendidos no período que já tinham pelo menos um atendimento anterior.
- Dia da semana e faixas horárias com maior número de atendimentos.
- Relatórios protegidos por autenticação ADMIN e filtrados pela unidade e barbearia autorizadas.
- Intervalo máximo de consulta de dez anos.

O resultado líquido nesta versão é calculado como receitas confirmadas menos despesas financeiras confirmadas no período. Margens de serviços usam o custo estimado salvo no atendimento; margem de produto usa custo e preço guardados em cada item vendido.

## Como validar localmente

1. Execute `npm run dev` no projeto e entre com o administrador.
2. Abra Painel → Relatórios.
3. Alterne hoje, semana, mês e ano; teste também um intervalo personalizado.
4. Compare os totais com Financeiro e confira rankings, margem, taxa de retorno e horários.
5. Teste um intervalo maior que dez anos pela URL; a API deve rejeitá-lo com mensagem de validação.

## Checagem de código

```powershell
node .\node_modules\typescript\bin\tsc --noEmit --pretty false
git diff --check
```
