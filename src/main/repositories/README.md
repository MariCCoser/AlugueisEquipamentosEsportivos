# repositories — Acesso a dados

Única camada que escreve SQL. Um repositório por tabela, todos herdando de `BaseRepository`
(`criar`, `buscarPorId`, `listar`, `atualizar`, `excluir`).

- Exemplo: `ClienteRepository.ts`, `ReservaRepository.ts`
- **Sempre** queries parametrizadas (`WHERE id = ?`), nunca concatenar texto na SQL.
- Não contém regra de negócio — isso fica em `services/`.

**Responsável:** Pessoa 1
