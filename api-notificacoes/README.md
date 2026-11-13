# api-notificacoes — API 4 (a nossa)

Pequena API em TypeScript + Express que avisa o cliente sobre a **devolução** e sobre **multas**.
O app (Electron) chama esta API; ela monta o texto e envia. Por enquanto o envio é **simulado**:
a mensagem aparece no terminal e fica guardada para conferir — nada sai de verdade para o cliente.

## Como ligar

1. No `.env` da raiz do projeto, confira `NOTIFICACOES_URL` e `NOTIFICACOES_CHAVE`
   (veja o `.env.example`; a chave precisa ter pelo menos 16 caracteres).
2. Num terminal separado: `npm run api:notificacoes`
3. Deve aparecer: `✔ API de notificações no ar em http://127.0.0.1:3333 (envios simulados)`

Ela só aceita conexões da própria máquina (`127.0.0.1`).

## Rotas

| Método e rota                           | Chave? | O que faz                                          |
| --------------------------------------- | ------ | -------------------------------------------------- |
| `GET /saude`                            | não    | Responde `{ "ok": true }` se a API está no ar      |
| `POST /notificacoes/lembrete-devolucao` | sim    | Lembra o cliente da data de devolução              |
| `POST /notificacoes/aviso-multa`        | sim    | Avisa o cliente da multa por atraso                |
| `GET /notificacoes`                     | sim    | Últimas notificações enviadas (mais nova primeiro) |

A chave vai no cabeçalho: `Authorization: Bearer <NOTIFICACOES_CHAVE>`.

Se o cliente tem e-mail, a mensagem vai por **e-mail**; se não, por **WhatsApp** (telefone).

### Exemplo — lembrete

```json
POST /notificacoes/lembrete-devolucao
{
  "cliente": { "nome": "Ana Souza", "email": "ana@email.com", "telefone": "11987654321" },
  "reservaId": 3,
  "dataDevolucaoPrevista": "2026-11-20",
  "equipamentos": ["Caiaque Duplo", "Remo"]
}
```

Resposta `201`:

```json
{
  "id": "8c1f…",
  "tipo": "LEMBRETE_DEVOLUCAO",
  "canal": "EMAIL",
  "destinatario": "ana@email.com",
  "mensagem": "Olá, Ana! Lembramos que a devolução da reserva nº 3 (Caiaque Duplo e Remo) está prevista para 20/11/2026. Devoluções em atraso geram multa. Obrigado!",
  "enviadaEm": "2026-11-13T14:00:00.000Z",
  "simulada": true
}
```

### Respostas de erro

| Código | Quando                                         |
| ------ | ---------------------------------------------- |
| 400    | Dado faltando ou inválido (a resposta explica) |
| 401    | Sem chave ou chave errada                      |
| 404    | Rota que não existe                            |
| 413    | Corpo maior que 10 KB                          |
| 500    | Erro inesperado (sem detalhes técnicos)        |

## Arquivos

| Arquivo             | O que faz                                                           |
| ------------------- | ------------------------------------------------------------------- |
| `src/server.ts`     | Lê o `.env` e liga o servidor                                       |
| `src/app.ts`        | Rotas, checagem da chave e tratamento de erros                      |
| `src/validacao.ts`  | Confere os dados recebidos                                          |
| `src/mensagens.ts`  | Monta os textos (data e dinheiro no formato brasileiro)             |
| `src/Mensageiro.ts` | Quem entrega: hoje `MensageiroSimulado`; dá para trocar por um real |

## Do lado do app

`src/main/integrations/NotificacaoClient.ts` chama esta API, e `src/main/services/NotificacaoService.ts`
busca no banco os dados da reserva/multa. Na tela: `window.api.notificacoes.enviarLembrete({ reservaId })`
e `window.api.notificacoes.enviarAvisoMulta({ multaId })`.

Testes: `tests/api-notificacoes/` e `tests/main/integrations/NotificacaoClient.test.ts`.

**Responsável:** Pessoa 1
