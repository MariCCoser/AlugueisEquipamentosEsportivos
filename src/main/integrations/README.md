# integrations — APIs externas (Requisito 3: 4 situações)

Uma classe cliente por API, todas usando `HttpClient.ts` (timeout com AbortController + cache).

| Classe              | API                         | Uso no sistema                           | Responsável |
| ------------------- | --------------------------- | ---------------------------------------- | ----------- |
| `ViaCepClient`      | ViaCEP                      | Preenche endereço no cadastro de cliente | Pessoa 3    |
| `ClimaClient`       | Open-Meteo / OpenWeatherMap | Alerta de clima ao confirmar reserva     | Pessoa 3    |
| `RotasClient`       | OpenRouteService / OSRM     | Rota até cliente com devolução atrasada  | Pessoa 3    |
| `NotificacaoClient` | API própria do grupo        | Lembrete de devolução / aviso de multa   | Pessoa 1    |

Chaves de API ficam no `.env`. Falha de rede deve gerar mensagem amigável, nunca travar o app.
