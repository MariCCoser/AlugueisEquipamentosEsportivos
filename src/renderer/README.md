# renderer — Interface (telas)

Roda no navegador do Electron, **sem acesso ao Node**. Só conversa com o sistema por `window.api`.

**Abordagem escolhida:** TypeScript puro com classes (sem React/Vue). Mantém o padrão de
POO do resto do projeto, não acrescenta dependências e deixa explícito como cada tela monta o DOM.
Para não cair em XSS, nenhum texto vira HTML: tudo passa pelo ajudante `el()` de
[`nucleo/dom.ts`](nucleo/dom.ts), que usa `textContent`.

| Pasta / arquivo              | Parte                                                              |
| ---------------------------- | ------------------------------------------------------------------ |
| `index.html`                 | Página base, com a Content-Security-Policy e os `<link>` de estilo |
| `main.ts`                    | Ponto de entrada: cria o `App`                                     |
| `App.ts`                     | Menu lateral + lista de rotas (qual tela abre em cada endereço)    |
| [`nucleo/`](nucleo/)         | Roteador, contrato `Tela` e ajudante `el()` para criar elementos   |
| [`util/`](util/)             | Funções puras (rotas, formatação), testadas em `tests/renderer/`   |
| [`components/`](components/) | Componentes reutilizáveis                                          |
| [`pages/`](pages/)           | Telas do sistema                                                   |
| [`styles/`](styles/)         | Tema e estilos                                                     |
| [`dev/`](dev/)               | `window.api` simulado, só para desenvolvimento no navegador        |

## Como uma tela é criada

1. Crie uma classe em `pages/` que implementa `Tela` (`titulo` + `montar(alvo)`).
2. Registre a rota em `App.ts` (ex.: `{ caminho: '/categorias', criar: () => new CategoriasTela() }`).
3. Use `Consulta` para buscar dados (mostra carregando, vazio e erro sozinha) e `Tabela` para listar.

Endereços usam hash (`#/clientes/7`): no app instalado a página é aberta como arquivo
local, e caminhos sem hash quebrariam ao recarregar.

## Regras

- Sem scripts inline, sem `innerHTML` com dados do usuário, sem CDNs (a CSP bloqueia).
- Estilos entram por `<link>` no `index.html`, e não por `import './x.css'`: em modo dev o Vite
  injetaria o CSS como `<style>` inline, que a CSP `style-src 'self'` bloqueia.
- Sempre tratar `ok: false`; erros de validação chegam em `erro.campos` (use `aplicarErros`).
- Esconder um botão é só conforto visual: a permissão de verdade é verificada no Main.

## Testar as telas sem o Electron

Abrindo a interface num navegador comum em modo dev, o `main.ts` instala um `window.api`
simulado (`dev/apiSimulada.ts`) com dados de exemplo. Ele nunca entra no build de produção.

```bash
node node_modules/vite/bin/vite.js src/renderer --port 5199
```

**Responsável:** Pessoa 4
