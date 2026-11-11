# Aluguéis de Equipamentos Esportivos

Sistema desktop de gestão e aluguel de equipamentos esportivos — projeto final de DAD
(Desenvolvimento de Aplicações Desktop). Feito em **Electron + TypeScript**, com banco **MySQL 8**.

A arquitetura e o modelo de dados estão em [`docs/Proposta_Arquitetura_e_Banco.md`](docs/Proposta_Arquitetura_e_Banco.md).

## Requisitos

- Node.js **18.18+** (testado com 18.19)
- npm 9+
- MySQL 8 **ou** MariaDB 10.4+ (o do XAMPP serve)

## Instalação

```bash
git clone https://github.com/MariCCoser/AlugueisEquipamentosEsportivos.git
cd AlugueisEquipamentosEsportivos
npm install
cp .env.example .env   # depois preencha as credenciais do banco
npm run db:setup       # cria banco, tabelas e dados de exemplo
npm run dev
```

O `.npmrc` do projeto usa `bin-links=false` para o `npm install` funcionar também em pendrives
(exFAT/FAT32 não aceitam symlinks). Por isso os scripts chamam os binários pelo caminho
`node node_modules/...` em vez de `node_modules/.bin`.

## Scripts

| Comando                             | O que faz                                                   |
| ----------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                       | Abre o app em modo desenvolvimento (hot reload do Renderer) |
| `npm run build`                     | Checa tipos e gera o build em `out/`                        |
| `npm start`                         | Abre o app a partir do build                                |
| `npm run typecheck`                 | `tsc --noEmit` no Main/preload e no Renderer                |
| `npm run lint`                      | ESLint                                                      |
| `npm run format`                    | Prettier (`format:check` só verifica)                       |
| `npm test`                          | Testes com Vitest                                           |
| `npm run db:setup`                  | Cria banco, usuário do app, tabelas e dados de exemplo      |
| `npm run db:status`                 | Mostra quantos registros tem em cada tabela                 |
| `npm run db:resetar -- --confirmar` | Apaga o banco e recria do zero                              |

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

## Banco de dados

10 tabelas relacionadas por 11 chaves estrangeiras: `usuarios`, `clientes`, `categorias`,
`fornecedores`, `equipamentos`, `reservas`, `itens_reserva`, `manutencoes`, `multas`, `pagamentos`.
Detalhes em [`src/main/database/`](src/main/database/).

### Passo a passo (XAMPP)

1. Ligue o MySQL do XAMPP: `sudo /opt/lampp/lampp startmysql`
   (ou pelo painel `sudo /opt/lampp/manager-linux-x64.run` → aba _Manage Servers_ → _MySQL Database_ → _Start_).
2. Copie o `.env.example` para `.env` e confira:
   - `DB_ADMIN_USER` / `DB_ADMIN_PASSWORD`: o root do MySQL (no XAMPP, por padrão, sem senha).
   - `DB_USER` / `DB_PASSWORD`: o usuário que o app vai usar. Escolha uma senha; o setup cria esse usuário.
3. `npm run db:setup` — no final aparece a tabela com a quantidade de registros.
4. `npm run dev` — a tela inicial mostra **✔ Banco conectado** e as contagens.

Para ver os dados com interface gráfica: phpMyAdmin do XAMPP (`http://localhost/phpmyadmin`) ou MySQL Workbench.

Login de exemplo (para quando a tela de login existir): `admin@aluguel.local` / `Admin@2026`.

### Testes de integração

Os testes que acessam o banco de verdade ficam desligados por padrão. Com o banco criado:

```bash
DB_TESTE=1 npm test
```

## Estrutura de pastas

Cada pasta tem um `README.md` explicando a parte do sistema que ela contém, exemplos de arquivos e
quem do grupo é responsável. Comece por [`src/README.md`](src/README.md).

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
