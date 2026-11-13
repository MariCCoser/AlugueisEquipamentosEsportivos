# models — Enums e entidades

- `enums.ts` — valores possíveis das colunas ENUM do banco: `Perfil`, `Modalidade`,
  `EstadoConservacao`, `StatusEquipamento`, `StatusReserva`, `CaucaoStatus`, `TipoFornecedor`,
  `TipoManutencao`, `TipoPagamento`, `FormaPagamento` (cada um também como lista, ex.: `PERFIS`).
- `entidades.ts` — uma linha de cada tabela em camelCase (`Usuario`, `Cliente`, `Categoria`,
  `Fornecedor`, `Equipamento`, `Reserva`, `ItemReserva`, `Manutencao`, `Multa`, `Pagamento`) e os
  dados para criar cada uma (`NovoCliente`, `NovaReserva`...). É o que os repositórios devolvem.

Entidade ≠ DTO: a entidade é o registro do banco (pode ter `senhaHash`); o DTO é o que vai para a tela.

Definições propostas em `docs/Proposta_Arquitetura_e_Banco.md`, seção 7.

**Responsável:** Pessoa 2 (criados pela Pessoa 1 junto com os repositórios).
