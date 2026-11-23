# domain — Regras do aluguel sem banco (Requisito 5)

Classes que aplicam as regras do negócio **sem acessar o banco**. Os services carregam os dados
pelos repositórios e usam estas classes para decidir. Assim cada regra fica num lugar só e é
testada sem MySQL (`tests/main/domain/`).

| Classe                  | Regra                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `Dinheiro.ts`           | Valores em centavos inteiros (0,1 + 0,2 dá exato); imutável; arredonda só porcentagem         |
| `CalendarioISO.ts`      | Datas `AAAA-MM-DD` em UTC e em dias inteiros; recusa datas que não existem (31/02)            |
| `Periodo.ts`            | Diárias = devolução − retirada (mínimo 1); sobreposição com bordas inclusivas; dias de atraso |
| `CicloReserva.ts`       | PENDENTE → ATIVA → DEVOLVIDA; PENDENTE/ATIVA → CANCELADA; DEVOLVIDA e CANCELADA são finais    |
| `EquipamentoDominio.ts` | Preço obrigatório conforme a modalidade; só LOCACAO disponível pode ser reservado             |
| `ReservaDominio.ts`     | Valor total, caução sugerida (30%) e mudanças de status sempre pelo `CicloReserva`            |

Os tipos em `shared/models/` descrevem os **dados** das tabelas; estas classes aplicam as **regras**.

**Responsável:** Pessoa 2
