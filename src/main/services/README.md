# services — Regras de negócio

Classes que aplicam as regras do sistema usando os repositórios. Recebem as dependências pelo construtor.

| Service                                                             | Responsável |
| ------------------------------------------------------------------- | ----------- |
| Cliente, HistoricoCliente, Equipamento, Disponibilidade             | Pessoa 2 ✔  |
| `reserva/`: Reserva, ItemReserva, Devolucao                         | Pessoa 2 ✔  |
| `financeiro/`: Multa, Pagamento, SituacaoMulta; `multa/` (Strategy) | Pessoa 2 ✔  |
| Manutencao                                                          | Pessoa 2 ✔  |
| Auth, Usuario; `integracoes/`: PrevisaoClima, Rota                  | Pessoa 3 ✔  |
| Categoria, Fornecedor, Dashboard                                    | Pessoa 4 ✔  |
| Notificacao (lembrete e aviso de multa — API 4)                     | Pessoa 1 ✔  |

- Exemplo: `ReservaService.criar()` trava os equipamentos (`FOR UPDATE`), verifica a disponibilidade e grava reserva + itens numa transação.
- Os services dependem de `AcessoDados` (`UnidadeDeTrabalho.ts`), e não do banco direto: nos testes entra um banco em memória.
- As regras que não dependem do banco ficam em [`../domain/`](../domain/).
- Erros de regra lançam classes de `errors/` (ex.: `EquipamentoIndisponivelError`).
