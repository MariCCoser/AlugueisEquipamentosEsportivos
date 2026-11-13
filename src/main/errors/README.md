# errors — Classes de erro

Erros "esperados", com mensagem que pode ir direto para a tela. O registro IPC transforma
qualquer `ErroApp` em `{ ok: false, erro: { codigo, mensagem, campos } }`. Qualquer outro erro aparece
para o usuário só como "Erro inesperado" (o detalhe fica no terminal).

| Classe (`ErroApp.ts`) | Código           | Quando usar                            |
| --------------------- | ---------------- | -------------------------------------- |
| `ValidacaoError`      | `VALIDACAO`      | Dado enviado pela tela está errado     |
| `NaoEncontradoError`  | `NAO_ENCONTRADO` | O registro pedido não existe           |
| `RegraNegocioError`   | `REGRA_NEGOCIO`  | A ação vai contra uma regra do negócio |
| `NaoAutorizadoError`  | `NAO_AUTORIZADO` | Falta login ou permissão               |
| `IntegracaoError`     | `INTEGRACAO`     | Uma API externa falhou                 |

Erros mais específicos herdam destes, ex.:
`class EquipamentoIndisponivelError extends RegraNegocioError {}`.

**Responsável:** base da Pessoa 1; erros específicos de cada domínio, de quem cuida dele.
