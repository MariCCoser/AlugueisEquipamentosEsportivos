# migrations — Estrutura do banco

Scripts `.sql` numerados que criam e alteram as tabelas. Rodam em ordem e cada um só uma vez
(o controle fica na tabela `schema_migrations`).

- `001_criar_tabelas.sql` — as 10 tabelas, 11 chaves estrangeiras, índices e CHECKs
- **Nunca editar uma migration já aplicada**: para mudar algo, crie `002_descricao.sql`
- Para recriar do zero durante o desenvolvimento: `npm run db:resetar -- --confirmar`

Tabelas: usuarios, clientes, categorias, fornecedores, equipamentos, reservas, itens_reserva,
manutencoes, multas, pagamentos.

**Responsável:** Pessoa 1
