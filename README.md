# Aluguéis de Equipamentos Esportivos

Sistema desktop de gestão e aluguel de equipamentos esportivos — projeto final de DAD
(Desenvolvimento de Aplicações Desktop). Feito em **Electron + TypeScript**, com banco **MySQL 8**.

A arquitetura e o modelo de dados estão em [`docs/Proposta_Arquitetura_e_Banco.md`](docs/Proposta_Arquitetura_e_Banco.md).

## Requisitos

- Node.js **18.18+** (testado com 18.19)
- npm 9+
- MySQL 8 (necessário a partir da etapa de banco de dados)

## Instalação

```bash
git clone https://github.com/MariCCoser/AlugueisEquipamentosEsportivos.git
cd AlugueisEquipamentosEsportivos
npm install
cp .env.example .env   # depois preencha as credenciais do banco
```

O `.npmrc` do projeto usa `bin-links=false` para o `npm install` funcionar também em pendrives
(exFAT/FAT32 não aceitam symlinks). Por isso os scripts chamam os binários pelo caminho
`node node_modules/...` em vez de `node_modules/.bin`.

## Scripts

| Comando             | O que faz                                                   |
| ------------------- | ----------------------------------------------------------- |
| `npm run dev`       | Abre o app em modo desenvolvimento (hot reload do Renderer) |
| `npm run build`     | Checa tipos e gera o build em `out/`                        |
| `npm start`         | Abre o app a partir do build                                |
| `npm run typecheck` | `tsc --noEmit` no Main/preload e no Renderer                |
| `npm run lint`      | ESLint                                                      |
| `npm run format`    | Prettier (`format:check` só verifica)                       |
| `npm test`          | Testes com Vitest                                           |

### Linux: erro do `chrome-sandbox`

Se aparecer `The SUID sandbox helper binary was found, but is not configured correctly`, o
Electron não conseguiu usar o sandbox do sistema (acontece em pendrive, onde não dá para o
`chrome-sandbox` ter dono root). Nesse caso, só para desenvolvimento, use:

```bash
npm run dev:no-sandbox
npm run start:no-sandbox
```

Em disco normal, prefira corrigir a permissão:
`sudo chown root node_modules/electron/dist/chrome-sandbox && sudo chmod 4755 node_modules/electron/dist/chrome-sandbox`.

## Estrutura de pastas

```
src/
├── main/            # Main Process (Node): janela, IPC, banco, regras de negócio
│   ├── main.ts      # cria a BrowserWindow segura e registra o IPC
│   ├── config/      # leitura e validação do .env
│   ├── database/    # Database (pool mysql2), migrations e seeds
│   ├── repositories/
│   ├── services/
│   ├── integrations/  # APIs externas (CEP, clima, rotas, notificações)
│   ├── security/      # hash de senha, sessão, autorização, validators
│   ├── ipc/           # registrarHandlers.ts + um arquivo por domínio
│   └── errors/
├── preload/
│   └── preload.ts   # contextBridge: expõe window.api tipado
├── renderer/        # Interface (HTML/CSS/TS), sem acesso ao Node
│   ├── index.html   # CSP restritiva
│   ├── main.ts
│   ├── styles/  components/  pages/
└── shared/          # Código usado pelo Main e pelo Renderer
    ├── ipc-channels.ts  # todos os canais 'dominio:acao'
    ├── api.ts           # contrato de window.api
    ├── models/          # enums e entidades
    └── dto/             # contratos de entrada/saída (Resposta<T>)
tests/               # Vitest
```

### Como adicionar um canal IPC

1. Adicione o nome em `src/shared/ipc-channels.ts` (ex.: `clientes: { listar: 'clientes:listar' }`).
2. Declare a função em `src/shared/api.ts` retornando `Promise<Resposta<T>>`.
3. Exponha em `src/preload/preload.ts` com `ipcRenderer.invoke(IPC.clientes.listar, ...)`.
4. Registre o handler no Main com `RegistroIpc.registrar(...)` (`src/main/ipc/`).

## Segurança do Electron

Configurada desde o início em `src/main/main.ts` e `src/renderer/index.html`:

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`
- Renderer só acessa o Main por `window.api` (nunca o `ipcRenderer` inteiro)
- Todo handler IPC valida a origem (`senderFrame.url`) e não devolve stack trace ao Renderer
- CSP `default-src 'self'` no HTML
- Navegação externa bloqueada (`will-navigate`) e `window.open` negado (links `https://` abrem no navegador do sistema)
- `.env` fora do Git
