# repositories — Acesso a dados

Única camada que escreve SQL. Um repositório por tabela, todos herdando de `BaseRepository`.
Não contém regra de negócio — isso fica em `services/`.

| Arquivo                    | Tabela          | Métodos além do CRUD                                                                                               |
| -------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `BaseRepository.ts`        | —               | `criar`, `buscarPorId`, `listar`, `listarPaginado`, `contar`, `atualizar`, `excluir`                               |
| `UsuarioRepository.ts`     | `usuarios`      | `buscarPorEmail`, `listarAtivos`, `registrarLogin`                                                                 |
| `ClienteRepository.ts`     | `clientes`      | `buscarPorCpf`, `pesquisar`                                                                                        |
| `CategoriaRepository.ts`   | `categorias`    | `buscarPorNome`, `contarEquipamentos`                                                                              |
| `FornecedorRepository.ts`  | `fornecedores`  | `buscarPorCnpj`, `listarPorTipo`                                                                                   |
| `EquipamentoRepository.ts` | `equipamentos`  | `filtrar`, `listarPorStatus`, `listarPorCategoria`, `buscarPorIds`, `atualizarStatus`                              |
| `ReservaRepository.ts`     | `reservas`      | `listarPorStatus`, `listarPorCliente`, `listarAtrasadas`, `equipamentoReservadoNoPeriodo`, `atualizarStatus`       |
| `ItemReservaRepository.ts` | `itens_reserva` | `listarPorReserva`, `listarPorEquipamento`, `registrarDevolucao`, `excluirDaReserva`                               |
| `ManutencaoRepository.ts`  | `manutencoes`   | `listarEmAberto`, `listarPorEquipamento`, `listarPorFornecedor`, `buscarEmAbertoDoEquipamento`, `registrarRetorno` |
| `MultaRepository.ts`       | `multas`        | `buscarPorReserva`, `listarEmAberto`, `quitar`                                                                     |
| `PagamentoRepository.ts`   | `pagamentos`    | `listarPorReserva`, `somarPorReserva`, `somarPorMulta`, `somarNoPeriodo`                                           |
| `index.ts`                 | —               | `criarRepositorios(executor)` — os 10 de uma vez                                                                   |

## Como usar

```ts
const repos = criarRepositorios(db);
const cliente = await repos.clientes.buscarPorCpf('52998224725');
await repos.clientes.atualizar(cliente.id, { telefone: '11999999999' }); // só muda o que vier

// várias gravações que precisam dar certo juntas
await db.transacao(async (tx) => {
  const r = criarRepositorios(tx);
  const reserva = await r.reservas.criar({
    clienteId,
    usuarioId,
    dataRetirada,
    dataDevolucaoPrevista
  });
  await r.itensReserva.criar({ reservaId: reserva.id, equipamentoId, valorDiaria, estadoRetirada });
});
```

- Devolvem **entidades** (`src/shared/models/entidades.ts`) em camelCase; colunas NULL viram `null`,
  TINYINT(1) vira `boolean`, DECIMAL vira `number`, DATE vira `'YYYY-MM-DD'`.
- A entidade `Usuario` tem `senhaHash`: o Service converte para DTO antes de mandar para a tela.
- Erros do MySQL (CPF duplicado `ER_DUP_ENTRY`, FK `ER_ROW_IS_REFERENCED_2`...) são repassados;
  o Service traduz para a mensagem amigável.

## Segurança

- Valores **sempre** pelos `?`, nunca concatenados na SQL.
- Nome de coluna não pode ser `?`; por isso só entram os campos declarados em `campos` de cada
  repositório. Chaves desconhecidas em `criar`/`atualizar` são ignoradas e `ordenarPor` só aceita
  campos conhecidos.
- Texto de busca passa por `escaparLike` (o usuário não consegue usar `%`/`_` como curinga).

## Testes

- `tests/main/repositories/*.test.ts` — rodam sempre, com um executor falso (sem MySQL).
- `repositorios.integracao.test.ts` — contra o MySQL, com `DB_TESTE=1 npm test`; cada teste
  roda numa transação desfeita no final, então não altera o banco.

**Responsável:** Pessoa 1
