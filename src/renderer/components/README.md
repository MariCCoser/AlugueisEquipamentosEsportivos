# components — Componentes reutilizáveis

Peças de interface usadas por várias telas. Todas inserem texto com `textContent` (nunca HTML).

| Componente         | Para que serve                                                                          |
| ------------------ | --------------------------------------------------------------------------------------- |
| `Layout.ts`        | Menu lateral + área de conteúdo; marca o item ativo com `aria-current`                  |
| `CabecalhoTela.ts` | Título (h1) da tela com botões de ação à direita                                        |
| `Consulta.ts`      | Busca dados no Main e mostra carregando → erro (com "Tentar de novo") / vazio / dados   |
| `Estados.ts`       | Os três estados obrigatórios: `carregando`, `estadoVazio`, `estadoErro`                 |
| `Tabela.ts`        | Tabela genérica tipada, com ordenação por coluna e ações por linha                      |
| `Campos.ts`        | `CampoTexto`, `CampoSelect`, `CampoCheckbox` com label/erro acessíveis + `aplicarErros` |
| `Modal.ts`         | Janela sobreposta (`<dialog>`): fecha com Esc e devolve o foco a quem abriu             |
| `ConfirmDialog.ts` | `confirmar(...)` antes de excluir; foco inicial em "Cancelar"                           |
| `Toast.ts`         | Avisos rápidos (`Toast.sucesso`, `Toast.erro`) em região `aria-live`                    |
| `Abas.ts`          | Abas acessíveis (setas, Home/End) — Fornecedores e Devoluções                           |

**Responsável:** Pessoa 4
