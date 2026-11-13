# database — Banco de dados (MySQL 8 / MariaDB)

| Arquivo / pasta              | O que é                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `Database.ts`                | Pool do `mysql2`, `consultar`, `executar` e `transacao(fn)` |
| `Migrator.ts`                | Roda os `.sql` em ordem e registra em `schema_migrations`   |
| `DiagnosticoBanco.ts`        | Lista das 10 tabelas e contagem de registros                |
| `cli.ts`                     | Comandos `npm run db:*` (terminal)                          |
| [`migrations/`](migrations/) | Criação/alteração das tabelas                               |
| [`seeds/`](seeds/)           | Dados de exemplo                                            |

## Comandos

| Comando                             | O que faz                                                        |
| ----------------------------------- | ---------------------------------------------------------------- |
| `npm run db:setup`                  | Cria o banco, o usuário do app, as tabelas e os dados de exemplo |
| `npm run db:status`                 | Mostra quantos registros tem em cada tabela                      |
| `npm run db:migrar`                 | Só aplica migrations novas                                       |
| `npm run db:seed`                   | Só aplica seeds novos                                            |
| `npm run db:resetar -- --confirmar` | **Apaga tudo** e roda o setup de novo                            |

## Como usar nos repositórios

```ts
// consulta simples — valores SEMPRE pelos "?"
const clientes = await db.consultar<ClienteLinha>('SELECT * FROM clientes WHERE cidade = ?', [cidade]);

// várias escritas que precisam dar certo juntas
await db.transacao(async (tx) => {
  const { idInserido } = await tx.executar('INSERT INTO reservas (...) VALUES (?, ?, ?)', [...]);
  await tx.executar('INSERT INTO itens_reserva (...) VALUES (?, ?)', [idInserido, ...]);
}); // se qualquer linha lançar erro, nada é gravado (ROLLBACK)
```

- `DATE`/`DATETIME` voltam como string `'YYYY-MM-DD'`; `DECIMAL` volta como `number`.
- O app conecta com `DB_USER` (só SELECT/INSERT/UPDATE/DELETE). Os comandos `db:*` usam
  `DB_ADMIN_USER`, porque precisam criar banco e tabelas.

Modelo das tabelas: `docs/Proposta_Arquitetura_e_Banco.md`, seção 3.

**Responsável:** Pessoa 1
