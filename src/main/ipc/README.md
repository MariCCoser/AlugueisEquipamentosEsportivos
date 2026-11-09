# ipc — Handlers dos canais IPC

Recebe as chamadas do Renderer e encaminha para os services.

- `registrarHandlers.ts` — classe `RegistroIpc`: registro central, valida a origem da chamada e
  converte erros inesperados em `Resposta` sem stack trace.
- Um arquivo por domínio: `clientes.ipc.ts`, `reservas.ipc.ts`, `auth.ipc.ts`...

Fluxo de cada handler: validar entrada (zod) → checar permissão → chamar service → `Resposta<T>`.

**Responsável:** cada pessoa cria os handlers do seu domínio; a estrutura central é da Pessoa 1.
