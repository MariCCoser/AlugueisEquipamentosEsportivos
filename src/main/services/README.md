# services — Regras de negócio

Classes que aplicam as regras do sistema usando os repositórios. Recebem as dependências pelo construtor.

| Service                                                   | Responsável |
| --------------------------------------------------------- | ----------- |
| Cliente, Equipamento, Disponibilidade, Reserva, Devolucao | Pessoa 2    |
| Multa (Strategy em `multa/`), Pagamento, Manutencao       | Pessoa 2    |
| Auth, Usuario                                             | Pessoa 3    |
| Categoria, Fornecedor, Dashboard                          | Pessoa 4    |

- Exemplo: `ReservaService.criar()` verifica disponibilidade e grava reserva + itens numa transação.
- Erros de regra lançam classes de `errors/` (ex.: `EquipamentoIndisponivelError`).
