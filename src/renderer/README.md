# renderer — Interface (telas)

Roda no navegador do Electron, **sem acesso ao Node**. Só conversa com o sistema por `window.api`.

| Pasta / arquivo              | Parte                                      |
| ---------------------------- | ------------------------------------------ |
| `index.html`                 | Página base, com a Content-Security-Policy |
| `main.ts`                    | Ponto de entrada da interface              |
| [`styles/`](styles/)         | Tema e estilos                             |
| [`components/`](components/) | Componentes reutilizáveis                  |
| [`pages/`](pages/)           | Telas do sistema                           |

Regras: sem scripts inline, sem `innerHTML` com dados do usuário, sempre tratar `ok: false`.

**Responsável:** Pessoa 4
