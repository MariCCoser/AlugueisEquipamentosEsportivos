# main — Processo principal (Main Process)

Roda em Node.js. É o único lugar com acesso ao banco, ao `.env`, ao sistema de arquivos e às APIs externas.

| Pasta / arquivo                  | Parte                                  | Responsável      |
| -------------------------------- | -------------------------------------- | ---------------- |
| `main.ts`                        | Ponto de entrada: cria a janela segura | Pessoa 1         |
| [`config/`](config/)             | Configuração (.env)                    | Pessoa 1         |
| [`database/`](database/)         | Conexão MySQL, migrations e seeds      | Pessoa 1         |
| [`repositories/`](repositories/) | Acesso a dados (SQL)                   | Pessoa 1         |
| [`services/`](services/)         | Regras de negócio                      | Pessoas 2, 3 e 4 |
| [`integrations/`](integrations/) | APIs externas                          | Pessoas 3 e 1    |
| [`security/`](security/)         | Senha, sessão, permissões, validação   | Pessoa 3         |
| [`ipc/`](ipc/)                   | Handlers dos canais IPC                | Todos            |
| [`errors/`](errors/)             | Classes de erro                        | Pessoa 2         |
