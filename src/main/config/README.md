# config — Configuração da aplicação

`Configuracao.ts` lê as variáveis do `.env` e valida antes de usar (erro claro se faltar algo).

```ts
Configuracao.carregarArquivoEnv();
const config = new Configuracao();
config.banco(); // { host, port, user, password, database, connectionLimit }
config.adminBanco(); // usuário root, só para os comandos npm run db:*
```

- Nunca colocar senhas ou chaves direto no código; sempre via `.env` (modelo em `.env.example`).
- Chaves das APIs externas entram aqui também (novos métodos, ex.: `apis()`).

**Responsável:** Pessoa 1 (banco) e Pessoa 3 (chaves de API)
