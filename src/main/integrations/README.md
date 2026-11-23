# integrations — APIs externas (Requisito 3: 4 situações)

Uma classe cliente por API. As três APIs públicas usam o `ClienteHttp.ts` (tempo limite com
AbortController e mensagens amigáveis) e o `CacheMemoria.ts` (cache em memória com validade).

| Classe              | API                               | Uso no sistema                           | Responsável |
| ------------------- | --------------------------------- | ---------------------------------------- | ----------- |
| `ViaCepClient`      | ViaCEP                            | Preenche endereço no cadastro de cliente | Pessoa 3 ✔  |
| `ClimaClient`       | Open-Meteo                        | Alerta de clima ao confirmar reserva     | Pessoa 3 ✔  |
| `RotasClient`       | Nominatim + OSRM (OpenStreetMap)  | Rota até cliente com devolução atrasada  | Pessoa 3 ✔  |
| `NotificacaoClient` | API própria (`api-notificacoes/`) | Lembrete de devolução / aviso de multa   | Pessoa 1 ✔  |

ViaCEP, Open-Meteo e OpenStreetMap não precisam de chave. A única chave é a da nossa API
(`NOTIFICACOES_CHAVE`, no `.env`). Falha de rede gera mensagem amigável e nunca trava o app.
