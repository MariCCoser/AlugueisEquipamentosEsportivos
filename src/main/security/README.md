# security — Segurança (Requisito 4)

**Feito (Pessoa 1):**

- `PoliticaOrigem.ts` — decide o que é página do próprio app (usado no IPC e na navegação) e quais links externos podem abrir no navegador
- `EndurecimentoElectron.ts` — sandbox global, permissões negadas, bloqueio de navegação, webview, pop-ups e downloads, DevTools só em desenvolvimento

**A fazer (Pessoa 3):**

- `SenhaHasher.ts` — hash e verificação de senha com bcrypt
- `Sessao.ts` — guarda o usuário logado **no Main** (o Renderer nunca informa quem é)
- `Autorizacao.ts` — `exigirPerfil('ADMIN')` usado nos handlers IPC
- [`validators/`](validators/) — validação dos dados que chegam pelo IPC

As decisões são justificadas em [`docs/SEGURANCA.md`](../../../docs/SEGURANCA.md).

**Responsáveis:** Pessoa 1 (Electron) e Pessoa 3 (login, permissões, validação)
