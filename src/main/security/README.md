# security — Segurança (Requisito 4)

- `SenhaHasher.ts` — hash e verificação de senha com bcrypt
- `Sessao.ts` — guarda o usuário logado **no Main** (o Renderer nunca informa quem é)
- `Autorizacao.ts` — `exigirPerfil('ADMIN')` usado nos handlers IPC
- [`validators/`](validators/) — validação dos dados que chegam pelo IPC

As decisões são justificadas em `docs/SEGURANCA.md`.

**Responsável:** Pessoa 3
