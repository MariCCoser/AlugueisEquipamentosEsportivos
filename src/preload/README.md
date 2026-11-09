# preload — Ponte segura (contextBridge)

Roda isolado antes da tela carregar e expõe `window.api` para o Renderer.

- `preload.ts` — uma função por canal IPC (nunca expõe o `ipcRenderer` inteiro)
- `preload.d.ts` — declara o tipo de `window.api` para o Renderer

O formato da API é definido em `shared/api.ts`.

**Responsável:** Pessoa 1
