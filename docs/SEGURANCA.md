# Segurança — decisões e justificativas

> Requisito 4 do professor: *"O grupo precisa pensar em segurança como parte do projeto [...] Cada grupo deve justificar as decisões de segurança que tomou para o seu sistema específico."*

**Por que segurança importa neste sistema:** o app guarda **dados pessoais de clientes** (nome, CPF, telefone, e-mail, endereço completo), **dados financeiros** (pagamentos, caução, multas) e tem **dois perfis de acesso** (ADMIN e FUNCIONARIO). Também é um app desktop que fala com APIs da internet (CEP, clima, rotas). Um erro de configuração no Electron pode transformar um simples XSS em execução de código no computador da loja.

| Parte | Responsável | Status |
|---|---|---|
| 1. Electron (isolamento, sandbox, navegação, IPC) | Pessoa 1 | Feito |
| 2. Banco de dados (queries parametrizadas, usuário com privilégio mínimo, segredos no `.env`) | Pessoa 1 | Feito |
| 3. Autenticação (bcrypt, login, sessão) | Pessoa 3 | Feito |
| 4. Controle de acesso por perfil | Pessoa 3 | Feito |
| 5. Validação de entradas (zod) | Pessoa 3 | Feito |
| 6. Dados sensíveis / LGPD | Pessoa 3 | Feito |
| 7. Interface (XSS, CSP, dados na tela) e instalador | Pessoa 4 | Feito |
| 8. APIs externas (chaves, timeout) | Pessoa 3 | Feito |

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

## 3. Autenticação (Pessoa 3)

Código: [`src/main/services/AuthService.ts`](../src/main/services/AuthService.ts), [`src/main/security/HashSenha.ts`](../src/main/security/HashSenha.ts), [`src/main/security/LimiteTentativas.ts`](../src/main/security/LimiteTentativas.ts), [`src/main/security/Sessao.ts`](../src/main/security/Sessao.ts), [`src/main/ipc/auth.ipc.ts`](../src/main/ipc/auth.ipc.ts).
Testes: [`tests/main/services/AuthService.test.ts`](../tests/main/services/AuthService.test.ts), [`tests/main/security/HashSenha.test.ts`](../tests/main/security/HashSenha.test.ts), [`tests/main/security/LimiteTentativas.test.ts`](../tests/main/security/LimiteTentativas.test.ts), [`tests/main/services/AuthUsuarios.integracao.test.ts`](../tests/main/services/AuthUsuarios.integracao.test.ts) (com o MySQL do seed).

| Decisão | Onde | Por quê |
|---|---|---|
| Senhas guardadas só como **hash bcrypt, custo 10** (coluna `senha_hash CHAR(60)`); o texto da senha nunca é gravado nem aparece em log | `HashSenha.ts`, `UsuarioService.ts` | Se o banco vazar, as senhas não aparecem. O bcrypt é lento de propósito e usa um *salt* aleatório por senha: a mesma senha gera hashes diferentes e não dá para usar tabelas prontas. Custo 10 deixa o login rápido para a pessoa e caro para quem tenta milhões de senhas. |
| O login acontece **no Main**: a tela manda e-mail e senha, o Main confere e responde só `{ id, nome, email, perfil }` | `AuthService.login` | A tela não recebe o hash nem decide se a senha está certa. O `UsuarioSessaoDTO` não tem campo de senha. |
| **Mensagem genérica**: "E-mail ou senha incorretos." tanto para e-mail que não existe quanto para senha errada | `AuthService.login` | Uma mensagem diferente para cada caso diria a um curioso quais e-mails têm conta na loja. |
| Quando o e-mail não existe, a senha é conferida mesmo assim contra um **hash fictício** | `HashSenha.conferir` | Sem isso a resposta para e-mail inexistente seria instantânea e a de senha errada demoraria (bcrypt), o que também revelaria quem tem conta. |
| **Limite de tentativas**: 5 senhas erradas seguidas bloqueiam aquele e-mail por 5 minutos, mesmo com a senha certa; um login certo zera a contagem | `LimiteTentativas.ts` | Impede testar uma lista de senhas na tela de login. O e-mail é comparado sem maiúsculas/espaços, para "Admin@" e "admin@" contarem juntos. |
| Usuário **desativado não entra**. Essa mensagem só aparece para quem acertou a senha | `AuthService.login` | Tirar o acesso de um ex-funcionário é desativar o usuário, sem apagar o histórico de reservas dele. Como a pessoa já provou que sabe a senha, dizer o motivo não revela nada. |
| Quem está logado fica na **`Sessao`, no Main**; `auth:logout` limpa a sessão | `Sessao.ts`, `auth.ipc.ts` | A tela não guarda token nem "perfil" que possa ser alterado. Toda chamada IPC consulta a sessão do Main. |
| **Trocar a senha** pede a senha atual e exige que a nova seja diferente; se o usuário foi desativado enquanto estava logado, a sessão é encerrada | `AuthService.alterarSenha` | Se alguém sentar num computador deixado logado, não consegue trocar a senha sem saber a atual. |
| Senha de **8 a 72 caracteres** (mesmo mínimo da tela, `SENHA_MINIMO`) | `usuario.schema.ts` | 8 é o mínimo combinado com a Pessoa 4. 72 é o limite do bcrypt: acima disso ele ignoraria o resto da senha sem avisar. |
| `ultimo_login` gravado com o relógio do banco a cada login certo | `UsuarioRepository.registrarLogin` | O ADMIN vê na tela Usuários quem não entra há muito tempo e pode desativar. |

**Limitações conhecidas:** o limite de tentativas fica na memória e recomeça se o app for fechado e aberto de novo. A sessão também é só da memória: fechar o app desloga. Para um app desktop de uma loja, onde quem tenta precisa estar no próprio computador, consideramos aceitável.

## 4. Controle de acesso por perfil (Pessoa 3)

Código: [`src/main/ipc/permissoes.ts`](../src/main/ipc/permissoes.ts) (tabela da Pessoa 1), [`src/main/services/UsuarioService.ts`](../src/main/services/UsuarioService.ts), [`src/main/ipc/usuarios.ipc.ts`](../src/main/ipc/usuarios.ipc.ts).
Testes: [`tests/main/ipc/auth-usuarios.ipc.test.ts`](../tests/main/ipc/auth-usuarios.ipc.test.ts), [`tests/main/services/UsuarioService.test.ts`](../tests/main/services/UsuarioService.test.ts), [`tests/main/ipc/permissoes.test.ts`](../tests/main/ipc/permissoes.test.ts).

| Decisão | Onde | Por quê |
|---|---|---|
| Dois perfis: **ADMIN** (tudo) e **FUNCIONARIO** (atendimento: clientes, reservas, devoluções, pagamentos). Cada canal tem `PUBLICO`, `LOGADO` ou `ADMIN`, conferido pelo `RegistroIpc` **antes** do handler | `permissoes.ts` | O funcionário do balcão não precisa cadastrar usuários, mudar preços ou apagar registros financeiros. Menos permissão = menos estrago se a conta dele for usada por outra pessoa. |
| Todos os canais `usuarios:*` são **só ADMIN**; `auth:login` e `auth:sessaoAtual` são públicos (a tela chama antes do login); `auth:logout` e `auth:alterarSenha` exigem alguém logado | `permissoes.ts`, `auth.ipc.ts` | `sessaoAtual` precisa responder `null` antes do login para a tela saber que deve mostrar o login; ele nunca devolve dados de outra pessoa. |
| A tela **esconde** o menu Usuários para o FUNCIONARIO, mas quem bloqueia é o Main | Pessoa 4 (seção 7.3) | Mesmo que alguém chame `window.api.usuarios.listar()` na mão como FUNCIONARIO, o Main responde `NAO_AUTORIZADO` sem nenhum dado (testado em `auth-usuarios.ipc.test.ts`). |
| O ADMIN **não pode desativar, rebaixar nem excluir a si mesmo** | `UsuarioService.atualizar` / `excluir` | Evita a loja ficar sem nenhum administrador por um clique errado. |
| Usuário que já **registrou reservas não pode ser excluído**, só desativado | `UsuarioService.excluir` (+ FK `ON DELETE RESTRICT`) | O histórico precisa continuar dizendo quem atendeu cada reserva. Desativar tira o acesso sem apagar esse registro. |
| O `usuarioId` da reserva vem **da sessão**, nunca da tela | `reservas.ipc.ts` (Pessoa 2) | A tela não consegue registrar uma reserva "em nome" de outro funcionário. |
| E-mail único com aviso no próprio campo (`erro.campos.email`) e o `UNIQUE` do banco como garantia final | `UsuarioService`, migration 001 | Dois usuários com o mesmo e-mail tornariam o login ambíguo. |

## 5. Validação de entradas (Pessoa 3)

Código: [`src/main/security/validators/`](../src/main/security/validators/) (`Validador.ts` e um `*.schema.ts` por domínio), [`src/shared/validadores/`](../src/shared/validadores/) (CPF e CNPJ).
Testes: [`tests/main/security/validators/`](../tests/main/security/validators/).

| Decisão | Onde | Por quê |
|---|---|---|
| **Todo** canal IPC que recebe dados passa por um schema **zod** antes de chegar ao service (`Validador.validar`) | handlers em `src/main/ipc/*.ipc.ts` | O que vem da tela é `unknown` até ser validado. Mesmo que alguém altere a tela ou chame `window.api` na mão, dado fora do formato não chega ao banco. |
| O schema **descarta campos que não conhece** | `Validador.ts` | Uma tela alterada que mande `perfil: 'ADMIN'` no login, `senhaHash` no cadastro de usuário ou `usuarioId` na reserva é simplesmente ignorada (há testes para isso). |
| **CPF** com os 2 dígitos verificadores (rejeita também `111.111.111-11`); **CNPJ** idem | `cliente.schema.ts`, `fornecedor.schema.ts`, `shared/validadores/` | A mesma função roda na tela (aviso na hora) e no Main (garantia). CPF errado impediria, por exemplo, a emissão de recibo. |
| **CEP** com 8 dígitos; **UF** com 2 letras; **e-mail** no formato certo e em minúsculas; **telefone** com DDD (10 ou 11 dígitos) | `campos.schema.ts` | Aceita com ou sem pontuação e grava só os dígitos, sempre no mesmo formato. |
| **Datas** `AAAA-MM-DD` que existem no calendário (recusa 30/02); **valores** positivos com no máximo 2 casas | `Campos.data`, `Campos.dinheiro` | Data impossível ou valor com 5 casas quebraria o cálculo de multa e o `DECIMAL(10,2)` do banco. |
| **Tamanho máximo** de cada texto = tamanho da coluna no banco | todos os schemas | O erro aparece embaixo do campo, em vez de virar um erro do MySQL. |
| Erros de validação voltam **por campo** (`{ codigo: 'VALIDACAO', campos: { cpf: '...' } }`) | `Validador.ts` | A tela marca o campo certo e a pessoa entende o que corrigir, sem mensagem técnica. |
| A validação acontece **antes** de qualquer chamada externa ou ao banco | ex.: `integracoes:buscarCep` | CEP com 4 dígitos nem chega ao ViaCEP: economiza internet e não manda lixo para fora. |

## 6. Dados sensíveis e LGPD (Pessoa 3)

Código: [`src/main/security/LogSeguro.ts`](../src/main/security/LogSeguro.ts), [`src/main/services/mapeadores/ClienteMapper.ts`](../src/main/services/mapeadores/ClienteMapper.ts), [`src/main/services/integracoes/RotaService.ts`](../src/main/services/integracoes/RotaService.ts).
Testes: [`tests/main/security/LogSeguro.test.ts`](../tests/main/security/LogSeguro.test.ts), [`tests/main/services/RotaService.test.ts`](../tests/main/services/RotaService.test.ts).

**Dados pessoais que o sistema guarda:** do cliente, nome, CPF, telefone, e-mail (opcional) e endereço; do funcionário, nome e e-mail. Base legal (LGPD, art. 7º, V): execução do contrato de aluguel. O CPF identifica quem é responsável pelo equipamento; o endereço serve para a busca presencial em caso de atraso.

| Decisão | Onde | Por quê |
|---|---|---|
| **Coletar só o necessário**: não há data de nascimento, RG, foto, renda ou dados de cartão. O e-mail do cliente é opcional | migration 001, `cliente.schema.ts` | Dado que não existe não vaza. Pagamento registra só forma e valor, nunca número de cartão. |
| **CPF mascarado** nas listagens (`***.982.247-**`), montado no Main; o CPF completo só aparece no formulário de edição | `ClienteMapper.mascararCpf`, Pessoa 4 (seção 7.4) | Quem está no balcão vê o suficiente para conferir o cliente sem o documento inteiro ficar exposto na tela. |
| **Logs sem dados pessoais**: antes de ir para o terminal, mensagens de erro passam pelo `LogSeguro`, que troca CPF/telefone por `[número]`, e-mail por `[e-mail]` e o texto de busca de URLs por `?[...]`. Os campos `sql` e `values` do erro do MySQL não são logados | `LogSeguro.ts`, `registrarHandlers.ts`, `app.ipc.ts`, `EndurecimentoElectron.ts` | Erro real do MySQL: *"Duplicate entry '52998224725' for key 'uk_clientes_cpf'"*. Sem a máscara, o CPF do cliente ficaria no log. Log costuma ser copiado para pedir ajuda, então não pode carregar dados pessoais. |
| **Senha e hash nunca saem do Main**: `UsuarioDTO` e `UsuarioSessaoDTO` não têm esses campos | `UsuarioService.paraDTO`, `AuthService.paraSessao` | Há testes conferindo que nenhuma resposta leva `senhaHash`. |
| **Minimização nas APIs externas**: para o mapa vão só rua, número, bairro, cidade, UF e CEP. Nome, CPF, telefone, e-mail e complemento **não saem do computador**. A previsão do tempo recebe só cidade e UF; o ViaCEP, só o CEP | `RotaService`, `PrevisaoClimaService`, `ViaCepClient` | Os serviços públicos não precisam saber **quem** mora no endereço. Há teste conferindo que nenhum dado pessoal vai na consulta do mapa. |
| A API de notificações recebe só nome, e-mail e telefone; nunca CPF ou endereço | Pessoa 1 (seção 2.2) | Mesmo princípio de minimização. |
| Cliente com reservas não é apagado (`ON DELETE RESTRICT`) | Pessoa 1 e 2 | O histórico financeiro precisa ser guardado. O que dá para fazer é corrigir os dados cadastrais (direito de correção, art. 18, III). |

**Limitação conhecida:** o banco não é criptografado em disco; a proteção é o usuário do MySQL com privilégio mínimo e a senha no `.env` (seção 2). Para uma loja, o recomendado é deixar o MySQL só em `127.0.0.1` e usar a criptografia de disco do próprio Windows (BitLocker).

---

## 7. Interface e instalador (Pessoa 4)

Código: [`src/renderer/nucleo/dom.ts`](../src/renderer/nucleo/dom.ts), [`src/renderer/components/`](../src/renderer/components/), [`src/renderer/pages/`](../src/renderer/pages/), [`src/renderer/index.html`](../src/renderer/index.html), [`electron-builder.yml`](../electron-builder.yml), [`src/main/config/LocalArquivoEnv.ts`](../src/main/config/LocalArquivoEnv.ts).
Testes: [`tests/main/config/LocalArquivoEnv.test.ts`](../tests/main/config/LocalArquivoEnv.test.ts), [`tests/shared/cnpj.test.ts`](../tests/shared/cnpj.test.ts) e os de `tests/renderer/`.

**Princípio:** a tela é a parte **menos confiável** do sistema. Ela existe para a pessoa trabalhar com conforto (máscaras, avisos na hora, botões que somem), mas nenhuma regra de segurança depende dela. Tudo o que a tela confere, o Main confere de novo.

> Algumas telas citadas aqui (clientes, usuários, reservas, devoluções) chegam pelos PRs #10 e #11.

### 7.1 Contra XSS (texto do banco nunca vira HTML)

| Decisão | Onde | Por quê |
|---|---|---|
| Todas as telas são montadas com `el()`, que coloca o texto com **`textContent`**. Nenhuma tela usa `innerHTML`, `outerHTML`, `insertAdjacentHTML` ou `document.write` | `nucleo/dom.ts` | Um cliente cadastrado com o nome `<img src=x onerror=alert(1)>` aparece na tabela **como texto**, sem executar nada. Os dados que vêm do banco (nomes, descrições, observações) são justamente o que um atacante controlaria. |
| Atributos entram com `setAttribute` como texto; eventos com `addEventListener` (nunca `onclick="..."`) | `nucleo/dom.ts` | Atributo de evento em texto é *script inline*, que a CSP bloqueia — e não queremos depender só da CSP. |
| A `Tabela` genérica recebe **funções** que devolvem texto ou elementos, nunca HTML pronto | `components/Tabela.ts` | Quem cria uma tela nova não tem como "esquecer" de escapar: não existe caminho para HTML. |
| Sem `eval`, `new Function` ou `setTimeout('texto')` | todo o renderer | A CSP (`script-src 'self'`, sem `'unsafe-eval'`) já bloquearia; o código nem tenta. |

### 7.2 Respeito à CSP

| Decisão | Onde | Por quê |
|---|---|---|
| Estilos carregados por `<link rel="stylesheet">` no `index.html` (`tema.css`, `layout.css`, `componentes.css`), e **não** por `import './x.css'` no `main.ts` | `src/renderer/index.html` | Em modo dev o Vite injeta o CSS importado como `<style>` inline, que a CSP (`style-src 'self'`) bloqueia. Com `<link>` a CSP continua restritiva, sem `'unsafe-inline'`, tanto em dev quanto no app instalado (PR #6). |
| Nada de `style="..."` montado com dados; a aparência muda por **classes** (`etiqueta--erro`, `cartao-numero--alerta`, `hidden`) | `styles/componentes.css` | Mantém `style-src 'self'` sem exceções. |
| Sem CDN, fontes ou imagens da internet; o ícone do app é um arquivo local | `index.html`, `build/` | `default-src 'self'`: a tela não fala com a internet. CEP, clima e rotas são buscados pelo Main. |

### 7.3 A tela não decide nada sozinha

| Decisão | Onde | Por quê |
|---|---|---|
| A tela de Usuários só mostra dados para ADMIN, mas quem bloqueia é o Main (`usuarios:*` = `ADMIN` em `permissoes.ts`) | `pages/usuarios/UsuariosTela.ts` | Esconder a tela é só para não confundir o funcionário. Quem digitar `#/usuarios` na mão recebe "sem permissão" do Main, sem nenhum dado. |
| A reserva é enviada **sem preço e sem usuário**: só cliente, datas, ids dos equipamentos e caução. O total mostrado antes de confirmar é uma estimativa | `pages/reservas/NovaReservaTela.ts` | Se a tela mandasse a diária ou o total, bastaria alterar a mensagem para alugar mais barato. O Main copia a diária do cadastro e pega o usuário da sessão. |
| A multa da devolução é **calculada pelo Main** (`multas:calcular`) e só mostrada na tela | `pages/devolucoes/DevolucaoFormulario.ts` | Mesmo motivo: valor financeiro nunca vem da tela. |
| Validações na tela (CPF, CNPJ, datas, valores) usam as **mesmas regras** do Main (`shared/validadores/`), mas o Main valida de novo com zod | formulários e `components/Campos.ts` | Avisar na hora é conforto; a garantia é no Main. Os erros do Main voltam por campo (`erro.campos`) e aparecem embaixo do campo certo (`aplicarErros`). |
| Parâmetros do endereço são conferidos: `#/clientes/abc` vira "endereço inválido" e `?aba=` / `?status=` só aceitam valores de uma lista | `ClienteHistoricoTela.ts`, telas com abas e filtros | O endereço (hash) é texto que qualquer um pode alterar. |

### 7.4 Dados pessoais e mensagens na tela

| Decisão | Onde | Por quê |
|---|---|---|
| Listas e histórico mostram o **CPF mascarado** (`***.456.789-**`), que já vem pronto do Main; o CPF completo só aparece no formulário de edição | `pages/clientes/` | LGPD: quem só consulta a lista não precisa ver o documento inteiro, e ele não fica exposto na tela do balcão. |
| Senhas em `type="password"` com `autocomplete="new-password"`; a senha nunca volta do Main (o `UsuarioDTO` não tem senha) e, na edição, "nova senha" é opcional | `pages/usuarios/UsuarioFormulario.ts` | A senha não fica visível nem é guardada pelo preenchimento automático. O Main grava só o hash (bcrypt, Pessoa 3). |
| A tela mostra só a `mensagem` amigável do Main. Falha de comunicação vira "Não foi possível se comunicar com o sistema" e o detalhe vai só para o console | `components/Consulta.ts` e formulários | Stack trace, SQL ou caminho de arquivo não aparecem para quem está no balcão. |
| Ações que não têm volta (excluir, cancelar reserva, desativar acesso) pedem **confirmação**, com o foco inicial em "Cancelar" | `components/ConfirmDialog.ts` | Um Enter apertado sem querer não apaga nada. |
| O link do mapa (rota até o cliente) vem do Main e abre com `target="_blank"`; quem decide se abre é o `setWindowOpenHandler` (só HTTPS de domínios da lista, seção 1.3) | `pages/devolucoes/DevolucoesTela.ts` | A tela não abre URL nenhuma por conta própria. |

### 7.5 API simulada só em desenvolvimento

| Decisão | Onde | Por quê |
|---|---|---|
| O `window.api` falso (dados de exemplo para trabalhar nas telas no navegador) só é carregado se **não houver preload** e `import.meta.env.DEV` for verdadeiro | `src/renderer/main.ts`, `src/renderer/dev/` | No build de produção `import.meta.env.DEV` é `false` e o Vite remove esse código: o app instalado nunca tem dados falsos nem um atalho que ignore o Main. Dentro do Electron o preload sempre existe, então nem em dev a simulação substitui o IPC real. |

### 7.6 Instalador (electron-builder)

| Decisão | Onde | Por quê |
|---|---|---|
| O `.env` **não entra** no instalador: o pacote leva só `out/**` e `package.json` (mais o `.env.example`, sem segredos) | `electron-builder.yml` → `files` | O instalador pode ser copiado e repassado; a senha do banco e a chave da API não podem ir junto. Cada loja tem o seu banco. |
| No app instalado, o `.env` é lido de `%APPDATA%\Locadora Esportiva\.env` (ou de ao lado do `.exe`), nunca da "pasta atual" | `src/main/config/LocalArquivoEnv.ts` | Aberto pelo menu Iniciar, a pasta atual costuma ser `C:\Windows\System32`. Um caminho fixo e conhecido evita ler um `.env` qualquer de outra pasta. A pasta de dados é do próprio usuário do Windows. |
| Código empacotado em **asar** e sem arquivos `.map` | `electron-builder.yml` | O código não fica solto em pastas para ser editado com o Bloco de Notas, e o pacote não leva o mapa do código-fonte. |
| DevTools desligado no app instalado (`devTools: !app.isPackaged`) | seção 1.1 (Pessoa 1) | No balcão, ninguém abre o console para chamar `window.api` na mão. |
| Instalação **por usuário** (`perMachine: false`), sem pedir administrador | `electron-builder.yml` → `nsis` | Privilégio mínimo: o instalador não precisa de permissão de administrador para nada. |
| **Sem atualização automática** (`publish: null`) | `electron-builder.yml` | O app não baixa nem executa nada da internet sozinho. Versão nova = instalador novo, gerado pelo grupo. |
| Desinstalar **não apaga** a pasta de dados (`deleteAppDataOnUninstall: false`) | `electron-builder.yml` | Reinstalar ou atualizar não perde a configuração da loja. Para remover tudo, é só apagar a pasta à mão (explicado em `docs/INSTALACAO.md`). |
| **Limitação conhecida:** o instalador não é assinado com certificado de código | — | Certificado é pago. Na primeira execução o Windows SmartScreen avisa ("Mais informações" → "Executar assim mesmo"). Em produção, assinar o `.exe` permitiria ao Windows confirmar quem publicou o programa. |

---

## 8. APIs externas (Pessoa 3)

Código: [`src/main/integrations/`](../src/main/integrations/) (`ClienteHttp.ts`, `CacheMemoria.ts`, `ViaCepClient.ts`, `ClimaClient.ts`, `RotasClient.ts`), [`src/main/services/integracoes/`](../src/main/services/integracoes/), [`src/main/ipc/integracoes.ipc.ts`](../src/main/ipc/integracoes.ipc.ts).
Testes: [`tests/main/integrations/`](../tests/main/integrations/), [`tests/main/services/PrevisaoClimaService.test.ts`](../tests/main/services/PrevisaoClimaService.test.ts), [`tests/main/ipc/integracoes.ipc.test.ts`](../tests/main/ipc/integracoes.ipc.test.ts).

| API | Serviço | Para quê | Chave? |
|---|---|---|---|
| 1. CEP | ViaCEP (`viacep.com.br`) | Preencher rua, bairro, cidade e UF no cadastro do cliente | Não |
| 2. Clima | Open-Meteo (`geocoding-api.open-meteo.com`, `api.open-meteo.com`) | Previsão do dia da retirada e alerta para categorias sensíveis ao clima | Não |
| 3. Rotas | Nominatim e OSRM (OpenStreetMap) | Distância e tempo até o cliente com devolução atrasada | Não |
| 4. Notificações | A nossa API (Pessoa 1, seção 2.2) | Lembrete de devolução e aviso de multa | Sim (`NOTIFICACOES_CHAVE` no `.env`) |

| Decisão | Onde | Por quê |
|---|---|---|
| As APIs são chamadas **só pelo Main**, nunca pela tela | `integracoes.ipc.ts` | A CSP da tela (`default-src 'self'`) bloqueia qualquer acesso à internet. Se um dia usarmos uma API com chave, ela fica no Main e nunca chega à tela. |
| Escolhemos APIs **sem chave** para CEP, clima e rotas | — | Nenhum segredo para guardar, vazar ou expirar. A configuração que existe (`LOJA_ENDERECO`, `INTEGRACOES_TEMPO_LIMITE_MS`) fica no `.env`, que não vai para o Git nem para o instalador; o `.env.example` mostra o formato. |
| Toda chamada tem **tempo limite** (8 s, `AbortController`) | `ClienteHttp.ts` | Se o serviço travar, a pessoa recebe "demorou demais" em vez de ficar com a tela parada. |
| Falha de rede, demora, limite de uso (HTTP 429), erro do servidor ou JSON inválido viram **`IntegracaoError` com frase amigável** | `ClienteHttp.ts` | A tela nunca recebe stack trace nem a resposta crua do serviço. Para o CEP a mensagem termina com "Preencha o endereço à mão." |
| **A integração nunca bloqueia o trabalho**: sem CEP, o endereço é digitado; sem previsão, a reserva continua ("Previsão indisponível"); sem rota, a devolução continua | `ViaCepClient`, `PrevisaoClimaService`, Pessoa 4 | A loja não para porque um serviço gratuito saiu do ar. |
| **Cache em memória** (CEP 1 dia, cidade 7 dias, previsão 1 hora, endereço no mapa 7 dias) com limite de itens | `CacheMemoria.ts` | Menos chamadas = mais rápido e respeita os limites de uso gratuitos (o Nominatim pede no máximo 1 pedido por segundo). Erros não ficam no cache. |
| Só **HTTPS**, endereços fixos no código; a tela não escolhe a URL | clientes em `integrations/` | Ninguém consegue fazer o Main chamar um endereço qualquer passando uma URL pela tela. |
| O Nominatim recebe um **User-Agent que identifica o sistema**, sem dados pessoais | `RotasClient.USER_AGENT` | Exigência da política de uso do OpenStreetMap. |
| O **link do mapa** é sempre `https://www.openstreetmap.org/...` | `RotasClient.linkMapa` | Esse domínio está na lista da `PoliticaOrigem` (seção 1.3), então o link abre no navegador do sistema; qualquer outro seria bloqueado. |
| A resposta das APIs é tratada como **dado não confiável**: só os campos esperados são copiados, números arredondados e textos com `trim` | `ViaCepClient`, `ClimaClient`, `RotasClient` | Um campo a mais ou um formato estranho na resposta não chega à tela. E a tela mostra tudo com `textContent` (seção 7.1). |
| Os testes usam **respostas falsas** (`fetch` de mentira) | `tests/main/integrations/` | Os testes não dependem da internet e cobrem os casos difíceis de reproduzir: CEP inexistente, tempo esgotado, limite diário, rota impossível. |
