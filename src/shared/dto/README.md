# dto — Contratos de entrada e saída

Interfaces dos dados que atravessam o IPC.

- `resposta.ts` — `Resposta<T>` (todo canal devolve `{ ok: true, dados }` ou `{ ok: false, erro }`), `Paginado<T>`
- `app.dto.ts` — informações do app
- Exemplo futuro: `cliente.dto.ts` (`CriarClienteDTO`, `ClienteDTO`), `reserva.dto.ts`

Datas trafegam como string ISO `'YYYY-MM-DD'`.

**Responsável:** cada pessoa cria os DTOs do seu domínio.
