# Fase 3 — Cadastros

Esta fase entrega CRUD administrativo de clientes, serviços e produtos. O D1 local já possui as tabelas necessárias; não há migration nova.

## Escopo entregue

- Cadastro, edição e inativação de clientes, preservando histórico com exclusão lógica.
- Consentimento LGPD, observações, preferência de corte e intervalo ideal de retorno.
- Cadastro, edição e inativação de serviços com duração, preço e custo estimado.
- Cadastro, edição e inativação de produtos com preço, custo e níveis de estoque.
- Formulários responsivos, validação no servidor, valores monetários em centavos e consultas limitadas à barbearia/unidade da associação administrativa.
- Rotas de API autenticadas e autorizadas pelo perfil ADMIN e por uma associação ADMIN ativa.

## Preparar o usuário administrador local

O cadastro público cria uma conta CLIENTE. Para habilitar a área administrativa no D1 local, substitua `SEU_EMAIL` pelo e-mail usado no cadastro. Execute cada comando no CMD, dentro da pasta `barbearia_informatizada`:

```bat
npx wrangler d1 execute barber-bar-db --local --command "UPDATE user SET role = 'ADMIN' WHERE email = 'SEU_EMAIL';"
npx wrangler d1 execute barber-bar-db --local --command "INSERT OR IGNORE INTO memberships (id, barbershop_id, unit_id, user_id, role) SELECT 'membership_owner_local', 'shop_demo', 'unit_demo', id, 'ADMIN' FROM users WHERE email = 'SEU_EMAIL';"
```

Confirme que o primeiro comando atualizou uma conta e o segundo inseriu uma associação. Depois saia e entre novamente para atualizar a sessão. Essa promoção é somente no banco local. O `.dev.vars` e outros arquivos locais continuam ignorados pelo Git.

## Executar e conferir

1. Com dependências instaladas e as migrations e seed locais já aplicadas, execute `npm run dev`.
2. Entre como o administrador local e abra o painel. Use os links **Clientes**, **Serviços** e **Produtos**.
3. Crie, edite e inative um registro de cada tipo. Confira campos obrigatórios, valores em R$, estoque e mensagens de validação.
4. Abra o sistema em uma janela anônima sem autenticação: as telas administrativas devem redirecionar para entrar e as APIs devem negar acesso.
5. Confirme no GitHub Desktop que `.dev.vars` e `node_modules` não aparecem entre as alterações; adicione `package-lock.json` se estiver pendente.

Ainda não há escrita ou publicação no D1 remoto nesta fase.
