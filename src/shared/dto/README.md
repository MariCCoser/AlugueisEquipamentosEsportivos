# dto — Contratos de entrada e saída

Formato dos dados que vão da tela para o sistema (entrada) e voltam (saída) em cada canal IPC.
Qual DTO cada canal usa está em [`../api.ts`](../api.ts).

| Arquivo              | Domínio                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `resposta.ts`        | `Resposta<T>` (todo canal devolve `{ ok, dados }` ou `{ ok, erro }`), `Paginado<T>`, `DataISO` |
| `comum.dto.ts`       | `IdDTO`, `ReservaIdDTO`, `PeriodoDTO`, `PaginacaoDTO`                                          |
| `app.dto.ts`         | Informações do app                                                                             |
| `banco.dto.ts`       | Situação do banco (tela inicial)                                                               |
| `auth.dto.ts`        | Login, sessão e troca de senha                                                                 |
| `usuario.dto.ts`     | Usuários do sistema                                                                            |
| `cliente.dto.ts`     | Clientes e histórico do cliente                                                                |
| `categoria.dto.ts`   | Categorias                                                                                     |
| `fornecedor.dto.ts`  | Fornecedores                                                                                   |
| `equipamento.dto.ts` | Equipamentos e disponibilidade                                                                 |
| `reserva.dto.ts`     | Reservas e itens da reserva                                                                    |
| `devolucao.dto.ts`   | Devolução                                                                                      |
| `multa.dto.ts`       | Multas                                                                                         |
| `manutencao.dto.ts`  | Manutenções                                                                                    |
| `pagamento.dto.ts`   | Pagamentos e caução                                                                            |
| `integracao.dto.ts`  | APIs externas: CEP, previsão do tempo e rotas                                                  |
| `notificacao.dto.ts` | Nossa API de notificações                                                                      |
| `dashboard.dto.ts`   | Números do painel                                                                              |
| `index.ts`           | Reúne tudo: `import type { ClienteDTO } from '@shared/dto'`                                    |

## Combinados

- Datas trafegam como texto `'YYYY-MM-DD'` (`DataISO`).
- `Criar...DTO` = cadastro; `Atualizar...DTO` = `id` + só os campos que mudaram;
  `Filtro...DTO` = opções de listagem; `...DTO` sem prefixo = o que a tela recebe.
- Nada que o sistema decide vem da tela: o usuário logado (`usuarioId`) e a diária do
  equipamento são preenchidos pelo Main.
- Nunca colocar senha, hash de senha ou CPF completo em DTO de saída (a tela usa `cpfMascarado`).

**Responsável:** estrutura da Pessoa 1; cada pessoa ajusta os DTOs do seu domínio.
