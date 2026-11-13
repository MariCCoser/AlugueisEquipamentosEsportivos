# Segurança — decisões e justificativas

> Requisito 4 do professor: *"O grupo precisa pensar em segurança como parte do projeto [...] Cada grupo deve justificar as decisões de segurança que tomou para o seu sistema específico."*

**Por que segurança importa neste sistema:** o app guarda **dados pessoais de clientes** (nome, CPF, telefone, e-mail, endereço completo), **dados financeiros** (pagamentos, caução, multas) e tem **dois perfis de acesso** (ADMIN e FUNCIONARIO). Também é um app desktop que fala com APIs da internet (CEP, clima, rotas). Um erro de configuração no Electron pode transformar um simples XSS em execução de código no computador da loja.

| Parte | Responsável | Status |
|---|---|---|
| 1. Electron (isolamento, sandbox, navegação, IPC) | Pessoa 1 | Feito |
| 2. Banco de dados (queries parametrizadas, usuário com privilégio mínimo, segredos no `.env`) | Pessoa 1 | Feito |
| 3. Autenticação (bcrypt, login, sessão) | Pessoa 3 | A fazer |
| 4. Controle de acesso por perfil | Pessoa 3 | A fazer |
| 5. Validação de entradas (zod) | Pessoa 3 | A fazer |
| 6. Dados sensíveis / LGPD | Pessoa 3 | A fazer |
| 7. Interface (XSS) | Pessoa 4 | Em andamento |
| 8. APIs externas (chaves, timeout) | Pessoa 3 | A fazer |

---

## 1. Electron (Pessoa 1)

Código: [`src/main/security/EndurecimentoElectron.ts`](../src/main/security/EndurecimentoElectron.ts), [`src/main/security/PoliticaOrigem.ts`](../src/main/security/PoliticaOrigem.ts), [`src/main/ipc/registrarHandlers.ts`](../src/main/ipc/registrarHandlers.ts), [`src/preload/preload.ts`](../src/preload/preload.ts), [`src/renderer/index.html`](../src/renderer/index.html).
Testes: [`tests/main/security/PoliticaOrigem.test.ts`](../tests/main/security/PoliticaOrigem.test.ts).

### 1.1 Renderer isolado

| Decisão | Onde | Por quê |
|---|---|---|
| `contextIsolation: true` | `preferenciasWeb()` | O JavaScript da tela roda em um "mundo" separado do preload. Mesmo que um script malicioso entre na tela, ele não consegue alterar o preload nem pegar objetos internos do Electron. |
| `nodeIntegration: false` (também em workers e sub-frames) | `preferenciasWeb()` | A tela **não tem acesso ao Node** (`require`, `fs`, `child_process`). Um XSS não vira "apagar arquivos" ou "rodar programas" no computador. |
| `sandbox: true` + `app.enableSandbox()` | `preferenciasWeb()` e `aplicarGlobal()` | O processo da tela roda com as restrições do Chromium. O `enableSandbox()` garante isso para **todas** as janelas, mesmo se alguém esquecer a opção numa janela nova. |
| `webSecurity: true`, `allowRunningInsecureContent: false` | `preferenciasWeb()` | Mantém a política de mesma origem e não carrega conteúdo HTTP dentro de página segura. |
| `webviewTag: false` + bloqueio de `will-attach-webview` | `preferenciasWeb()` e `protegerConteudo()` | `<webview>` poderia carregar sites externos com permissões próprias; o sistema não precisa disso. |
| `devTools: !app.isPackaged` | `preferenciasWeb()` | No app instalado na loja, o funcionário não consegue abrir o console e chamar `window.api` na mão. Em desenvolvimento continua disponível. |
| `navigateOnDragDrop: false` | `preferenciasWeb()` | Arrastar um arquivo para a janela não troca a tela por esse arquivo. |

### 1.2 Ponte única entre tela e sistema (preload + IPC)

| Decisão | Por quê |
|---|---|
| O preload expõe via `contextBridge` **somente funções específicas** (`window.api.app.info()`, `window.api.clientes.criar()`...), nunca o `ipcRenderer` inteiro | Se o `ipcRenderer` fosse exposto, qualquer script na tela poderia chamar qualquer canal, inclusive os que ainda serão criados. Com funções específicas, a "superfície de ataque" é só o que a tela realmente usa. |
| Nomes de canais centralizados em `shared/ipc-channels.ts` e tipados | Evita canais "soltos" e erros de digitação; a lista de canais é a lista do que a tela pode pedir. |
| `ipcMain.handle` (pedido → resposta), nunca `ipcMain.on` com `sendSync` | Não trava a interface e todo pedido tem uma resposta com formato padrão `Resposta<T>`. |
| **Validação do remetente** em todo handler (`evento.senderFrame.url` precisa ser a página do próprio app) | Se algum conteúdo externo for carregado por engano (iframe, redirecionamento), ele não consegue chamar o IPC. A checagem fica no `RegistroIpc`, então nenhum handler novo esquece. |
| `try/catch` central que devolve `falha('INTERNO', 'Erro inesperado...')` | Mensagens de erro do MySQL ou stack traces **não chegam à tela** (poderiam revelar nome de tabelas, caminhos de arquivo, usuário do banco). O detalhe fica só no log do Main. |

**Regra para todo o grupo:** a tela nunca é confiável. Toda decisão (permissão, validação, cálculo de multa) acontece no Main, mesmo que a tela já tenha validado.

### 1.3 Navegação e links externos

| Decisão | Por quê |
|---|---|
| `will-navigate` e `will-redirect` bloqueiam qualquer URL que não seja do app | Um link ou script malicioso não consegue trocar a tela do sistema por um site falso (ex.: uma tela de login falsa para roubar a senha do funcionário). |
| `setWindowOpenHandler` sempre retorna `deny` | Nenhum pop-up abre dentro do app. |
| Links externos só abrem no navegador do sistema se forem **HTTPS** e de um **domínio da lista** (`openstreetmap.org`, `google.com`) | `shell.openExternal` com URL qualquer é perigoso (`file://`, `javascript:`, sites falsos). Lista fechada = só o mapa da rota até o cliente. |
| Comparação por **origem completa** (protocolo + host + porta) em vez de `startsWith` | `startsWith('http://localhost:5173')` aceitaria `http://localhost:51730` ou `http://localhost:5173.site-falso.com`. Coberto por testes. |

### 1.4 Permissões e sessão

| Decisão | Por quê |
|---|---|
| `setPermissionRequestHandler` e `setPermissionCheckHandler` negam tudo | O sistema não usa câmera, microfone, localização, notificações do navegador, área de transferência avançada etc. Por padrão o Electron **aceita** esses pedidos; negar fecha essa porta. |
| Downloads bloqueados (`will-download`) | A tela não deve conseguir baixar e salvar arquivos no computador. |
| Instância única (`requestSingleInstanceLock`) | Evita dois apps abertos com duas sessões de login e dois pools de conexão no banco ao mesmo tempo. |

### 1.5 Content-Security-Policy (CSP)

Definida em `src/renderer/index.html`:

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'
```

| Diretiva | Por quê |
|---|---|
| `script-src 'self'` (sem `'unsafe-inline'` e sem `'unsafe-eval'`) | Mesmo que alguém consiga injetar `<script>` ou `onclick="..."` na página, o navegador **não executa**. É a principal defesa contra XSS. |
| `default-src 'self'` | A tela não faz requisições para a internet. As APIs externas (CEP, clima, rotas) são chamadas **pelo Main**, nunca pela tela, o que também protege as chaves de API. |
| `object-src 'none'`, `frame-src 'none'` | Sem plugins e sem iframes. |
| `base-uri 'none'`, `form-action 'none'` | Impede trocar a base dos links e enviar formulários para fora. Os formulários do app usam `window.api`, não `action=`. |

**Regra para a Pessoa 4:** nada de `<script>` inline, `style="..."` dinâmico com dados do usuário, `innerHTML` com dados do banco ou `eval`. Usar `textContent`.

---

## 2. Banco de dados (Pessoa 1)

| Decisão | Por quê |
|---|---|
| **Queries sempre parametrizadas** (`?` no `mysql2`) na classe `Database` | Impede SQL injection: o valor digitado (ex.: nome `'; DROP TABLE clientes; --`) é tratado como texto, nunca como comando. |
| O app conecta com um **usuário com privilégio mínimo** (`DB_USER`: só SELECT/INSERT/UPDATE/DELETE) | Mesmo se houver uma falha, o app não consegue apagar tabelas, criar usuários ou mexer em outros bancos. O usuário administrador (`DB_ADMIN_USER`) é usado **só** pelos comandos `npm run db:*`. |
| Credenciais no **`.env`**, que está no `.gitignore` | Senhas não vão para o GitHub. O `.env.example` é só um modelo. |
| Erros do banco não vão para a tela | Ver 1.2. |
| `ON DELETE RESTRICT` nas tabelas com histórico financeiro | Um clique errado não apaga reservas, pagamentos e multas em cascata. |
| Repositórios só usam **nomes de coluna declarados no código** | Nome de coluna não pode ir no `?`; por isso chaves desconhecidas vindas de fora são ignoradas e `ordenarPor` só aceita campos conhecidos. Texto de busca passa por `escaparLike`. |

## 2.1 Permissões por canal (Pessoa 1)

| Decisão | Por quê |
|---|---|
| Cada canal tem `PUBLICO`, `LOGADO` ou `ADMIN` em `src/main/ipc/permissoes.ts`, conferido no Main **antes** do handler | Esconder um botão na tela não protege nada; a tela é a parte menos confiável. O `Record<CanalIpc, ...>` faz o TypeScript acusar canal novo sem permissão. |
| Quem está logado fica na `Sessao`, no Main | A tela não consegue se passar por outro usuário nem por ADMIN. |
| Erros esperados (`ErroApp`) mostram a mensagem; os outros viram "Erro inesperado" | A pessoa entende o que houve, mas SQL e stack trace nunca chegam à tela. |

## 2.2 API de notificações (Pessoa 1)

| Decisão | Por quê |
|---|---|
| Escuta só em `127.0.0.1` | Ninguém da rede consegue chamar a API, só a própria máquina. |
| Exige `Authorization: Bearer <NOTIFICACOES_CHAVE>`, comparada em tempo constante (`timingSafeEqual`) | Outro programa na máquina não dispara mensagens; a demora da resposta não revela pedaços da chave. A chave fica no `.env`. |
| Valida todos os campos e limita o corpo a 10 KB | Dado estranho é recusado com 400; corpo gigante, com 413. |
| O app manda só **nome, e-mail e telefone** do cliente | LGPD: CPF e endereço não saem do banco para a notificação. |
| Sem `x-powered-by` e erros 500 sem detalhes | Não entrega pistas sobre a tecnologia nem sobre o erro interno. |
| No app, `NotificacaoClient` tem tempo limite (`AbortSignal.timeout`) | Se a API cair ou travar, a tela recebe uma mensagem amigável em vez de ficar esperando para sempre. |

---

## 3 a 8. Partes da Pessoa 3 e da Pessoa 4

*A preencher pelos responsáveis seguindo o mesmo formato (Decisão | Onde | Por quê).* Itens previstos:

- **Autenticação (P3):** bcrypt custo ≥ 10, mensagem de erro genérica, limite de tentativas, sessão guardada no Main.
- **Controle de acesso (P3):** `exigirPerfil('ADMIN')` nos handlers; a tela só esconde botões, quem bloqueia é o Main.
- **Validação (P3):** zod em todo DTO que chega pelo IPC (CPF, CEP, e-mail, datas, valores).
- **LGPD (P3):** CPF mascarado nas listagens, logs sem dados pessoais, coletar só o necessário.
- **Interface (P4):** `textContent` em vez de `innerHTML`, respeitar a CSP.
- **APIs externas (P3):** chaves no `.env`, timeout, tratamento de falha de rede.
