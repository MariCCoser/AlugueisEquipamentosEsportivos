# database — Banco de dados (MySQL 8)

- `Database.ts` — classe com o pool do `mysql2/promise` e o método `transacao(fn)`
- `Migrator.ts` — executa as migrations em ordem e registra quais já foram aplicadas
- [`migrations/`](migrations/) — criação/alteração das tabelas
- [`seeds/`](seeds/) — dados de exemplo

Modelo das tabelas: `docs/Proposta_Arquitetura_e_Banco.md`, seção 5.

**Responsável:** Pessoa 1
