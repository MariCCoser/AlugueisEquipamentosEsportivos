# config — Configuração da aplicação

`Configuracao.ts` lê as variáveis do `.env` e valida antes de usar (erro claro se faltar algo).

```ts
Configuracao.carregarArquivoEnv();
const config = new Configuracao();
config.banco(); // { host, port, user, password, database, connectionLimit }
config.adminBanco(); // usuário root, só para os comandos npm run db:*
config.notificacoes(); // URL, chave e tempo limite da nossa API de notificações
config.integracoes(); // tempo limite das APIs externas e endereço da loja (origem da rota)
```

- Nunca colocar senhas ou chaves direto no código; sempre via `.env` (modelo em `.env.example`).
- No app instalado, o `.env` fica na pasta de dados do usuário (ver `LocalArquivoEnv.ts`).

**Responsável:** Pessoa 1 (banco e notificações) e Pessoa 3 (APIs externas)
