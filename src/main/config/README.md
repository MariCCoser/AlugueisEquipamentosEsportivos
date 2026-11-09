# config — Configuração da aplicação

Lê as variáveis do `.env` (banco, chaves de API) e valida se estão todas presentes antes do app iniciar.

- Exemplo: `env.ts` exportando um objeto tipado `{ db: { host, port, user, ... }, apis: { ... } }`
- Nunca colocar senhas ou chaves direto no código; sempre via `.env` (modelo em `.env.example`).

**Responsável:** Pessoa 1 (banco) e Pessoa 3 (chaves de API)
