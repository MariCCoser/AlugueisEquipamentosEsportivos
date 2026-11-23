# security — Segurança (Requisito 4)

**Pessoa 1 (Electron):**

- `PoliticaOrigem.ts` — decide o que é página do próprio app (usado no IPC e na navegação) e quais links externos podem abrir no navegador
- `EndurecimentoElectron.ts` — sandbox global, permissões negadas, bloqueio de navegação, webview, pop-ups e downloads, DevTools só em desenvolvimento
- `Sessao.ts` — guarda o usuário logado **no Main** (o Renderer nunca informa quem é)

**Pessoa 3 (login, validação e LGPD):**

- `HashSenha.ts` — hash e conferência de senha com bcrypt (custo 10)
- `LimiteTentativas.ts` — 5 senhas erradas seguidas bloqueiam o e-mail por 5 minutos
- `LogSeguro.ts` — mascara CPF, telefone e e-mail antes de escrever no log
- [`validators/`](validators/) — `Validador` + um schema zod por domínio (os de cliente, equipamento, reserva, financeiro e manutenção foram escritos pela Pessoa 2, junto com os services)

A permissão de cada canal (PUBLICO / LOGADO / ADMIN) fica em [`ipc/permissoes.ts`](../ipc/permissoes.ts) e é conferida pelo `RegistroIpc` antes de qualquer handler.

As decisões são justificadas em [`docs/SEGURANCA.md`](../../../docs/SEGURANCA.md).

**Responsáveis:** Pessoa 1 (Electron) e Pessoa 3 (login, permissões, validação, LGPD)
