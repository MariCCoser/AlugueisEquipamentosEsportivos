# Arquitetura em Camadas e Dicionário de Dados

**Projeto:** Sistema de Gestão & Aluguel de Equipamentos Esportivos
**Disciplina:** DAD — Desenvolvimento de Aplicações Desktop (Electron + TypeScript)
**Responsável por este documento:** Pessoa 1 (arquitetura, banco, segurança do Electron, API própria)

Este documento descreve **como o sistema está montado hoje**. A proposta original (com os motivos
de cada escolha) está em [`Proposta_Arquitetura_e_Banco.md`](Proposta_Arquitetura_e_Banco.md);
as decisões de segurança, em [`SEGURANCA.md`](SEGURANCA.md).

---

## 1. Visão geral

O sistema é um app **desktop em Electron**, todo em **TypeScript** (`strict: true`), com banco **MySQL**.
Ele é dividido em camadas, e cada uma só conversa com a vizinha:

```
┌──────────────────────────────┐
│  Renderer (tela)             │  HTML/CSS/TS. Sem acesso ao Node nem ao banco.
└──────────────┬───────────────┘
               │ window.api.clientes.criar({...})
┌──────────────▼───────────────┐
│  Preload (ponte)             │  Expõe só funções específicas (contextBridge).
└──────────────┬───────────────┘
               │ ipcRenderer.invoke('clientes:criar', dados)
┌──────────────▼───────────────┐
│  IPC (RegistroIpc)           │  Confere origem e permissão; trata erros.
└──────────────┬───────────────┘
┌──────────────▼───────────────┐
│  Services                    │  Regras de negócio (ex.: reserva só se o item estiver livre).
└──────┬────────────────┬──────┘
┌──────▼───────┐ ┌──────▼──────────────┐
│ Repositories │ │ Integrations        │  Repositórios: único lugar com SQL.
└──────┬───────┘ └──────┬──────────────┘  Integrations: APIs externas e a nossa.
┌──────▼───────┐ ┌──────▼──────────────┐
│ MySQL        │ │ ViaCEP, clima, rotas│
│ (10 tabelas) │ │ api-notificacoes    │
└──────────────┘ └─────────────────────┘
```

**Por que assim?**

- **Segurança:** a tela (a parte mais exposta) não toca em banco, arquivos nem Node. Tudo passa
  por uma porta só, que confere quem está pedindo.
- **Organização (POO):** cada camada é um conjunto de classes com uma responsabilidade.
  Trocar o banco ou a tela não exige reescrever as regras.
- **Testes:** como cada classe recebe suas dependências pelo construtor, dá para testar com
  versões "de mentira" (ex.: um banco falso que só registra o SQL).

---

## 2. O caminho de uma chamada

Exemplo: o funcionário clica em **"Lembrar devolução"** na reserva 3.

1. **Tela** chama `window.api.notificacoes.enviarLembrete({ reservaId: 3 })`.
2. **Preload** repassa para o canal `notificacoes:enviarLembrete`.
3. **RegistroIpc** (no Main) confere:
   - a chamada veio da nossa própria tela? (senão: `NAO_AUTORIZADO`)
   - o canal é `LOGADO` — tem alguém logado? (senão: "Faça login para continuar.")
4. **Handler** valida a entrada (`reservaId` precisa ser inteiro positivo) e chama o service.
5. **NotificacaoService** busca a reserva, os itens e o cliente pelos **repositórios** e confere a
   regra (só reservas pendentes ou ativas).
6. **NotificacaoClient** chama a **nossa API** (`POST /notificacoes/lembrete-devolucao`) com a chave
   de acesso e tempo limite.
7. A resposta volta como `{ ok: true, dados: NotificacaoDTO }`. Se algo der errado em qualquer
   ponto, volta `{ ok: false, erro: { codigo, mensagem } }` com uma mensagem amigável.

---

## 3. As camadas, uma por uma

### 3.1 Renderer — `src/renderer/`

A interface. Roda isolada (`contextIsolation`, `sandbox`, sem `nodeIntegration`) e com uma CSP
restritiva. Só enxerga o que o preload expõe em `window.api`.
Hoje tem a tela inicial com o status do banco; as demais telas são da Pessoa 4.

### 3.2 Preload — `src/preload/preload.ts`

A **única ponte** entre a tela e o sistema. Cria uma função para cada um dos 80 canais
(`chamar(IPC.clientes.criar)`) e nunca expõe o `ipcRenderer` inteiro.

### 3.3 Contrato compartilhado — `src/shared/`

Tipos usados pelos dois lados, para a tela e o Main nunca "discordarem":

| Arquivo              | O que define                                                     |
| -------------------- | ---------------------------------------------------------------- |
| `ipc-channels.ts`    | Os nomes dos canais (`dominio:acao`) e a lista `TODOS_OS_CANAIS` |
| `api.ts`             | A `window.api`: o que cada função recebe e devolve               |
| `dto/`               | Os formatos de entrada e saída de cada domínio                   |
| `dto/resposta.ts`    | `Resposta<T>`, `Paginado<T>`, `DataISO`                          |
| `models/enums.ts`    | Valores possíveis (perfil, status, modalidade...)                |
| `models/entidades.ts`| Uma linha de cada tabela, em camelCase                           |

### 3.4 IPC — `src/main/ipc/`

| Classe / arquivo         | Papel                                                                  |
| ------------------------ | ---------------------------------------------------------------------- |
| `RegistroIpc`            | Liga os 80 canais; confere origem e permissão; converte erros          |
| `permissoes.ts`          | Quem pode usar cada canal: 4 `PUBLICO` (2 deles do app), 52 `LOGADO`, 24 `ADMIN` |
| `app.ipc.ts`             | Canais `app:info` e `app:statusBanco`                                  |
| `notificacoes.ipc.ts`    | Canais `notificacoes:enviarLembrete` e `notificacoes:enviarAvisoMulta` |

Canal ainda sem service responde _"Esta função ainda não foi implementada."_ — o app não quebra
enquanto o grupo implementa os domínios.

**Os 78 canais da proposta por domínio:** auth 4 · usuarios 5 · clientes 6 · categorias 5 ·
fornecedores 6 · equipamentos 8 · reservas e itens 14 · devoluções e multas 9 · manutencoes 8 ·
pagamentos 7 · integracoes 3 · notificacoes 2 · dashboard 1. (Lista completa: proposta, seção 6.)

### 3.5 Services — `src/main/services/`

Regras de negócio. Recebem repositórios e clientes de API pelo construtor.

| Service                 | Situação                    | Responsável |
| ----------------------- | --------------------------- | ----------- |
| `NotificacaoService`    | Pronto                      | Pessoa 1    |
| Cliente, Equipamento, Disponibilidade, Reserva, Devolucao, Multa, Pagamento, Manutencao | A fazer | Pessoa 2 |
| Auth, Usuario           | A fazer                     | Pessoa 3    |
| Categoria, Fornecedor, Dashboard | A fazer            | Pessoa 4    |

Erros esperados usam as classes de `src/main/errors/ErroApp.ts` (`ValidacaoError`,
`NaoEncontradoError`, `RegraNegocioError`, `IntegracaoError`); a mensagem delas vai direto para a tela.

### 3.6 Repositories — `src/main/repositories/`

**Única camada que escreve SQL.** Todos herdam de `BaseRepository<Entidade, Novo>`:

| Método                         | O que faz                                                      |
| ------------------------------ | -------------------------------------------------------------- |
| `criar(dados)`                 | INSERT só com os campos informados; devolve o registro criado  |
| `buscarPorId(id)`              | O registro ou `null`                                           |
| `listar(opcoes)` / `listarPaginado(opcoes)` | Com página, tamanho (máx. 100) e ordenação segura |
| `contar()`                     | Total de registros                                             |
| `atualizar(id, dados)`         | UPDATE só dos campos informados (`null` grava NULL)            |
| `excluir(id)`                  | `true` se apagou                                               |

Um repositório por tabela: `UsuarioRepository`, `ClienteRepository`, `CategoriaRepository`,
`FornecedorRepository`, `EquipamentoRepository`, `ReservaRepository`, `ItemReservaRepository`,
`ManutencaoRepository`, `MultaRepository`, `PagamentoRepository`. Cada um acrescenta as consultas
do seu domínio (ex.: `ReservaRepository.equipamentoReservadoNoPeriodo`, `listarAtrasadas`).
`criarRepositorios(executor)` cria os 10 de uma vez — com o pool ou dentro de uma transação.

### 3.7 Database — `src/main/database/`

| Classe             | Papel                                                                      |
| ------------------ | -------------------------------------------------------------------------- |
| `Database`         | Pool do `mysql2`, `consultar`, `executar` e `transacao(fn)` (COMMIT/ROLLBACK) |
| `Migrator`         | Roda os `.sql` em ordem e registra em `schema_migrations`                  |
| `DiagnosticoBanco` | Conta os registros das 10 tabelas (tela inicial e `db:status`)             |
| `cli.ts`           | Comandos `npm run db:setup / migrar / seed / status / resetar`             |

### 3.8 Integrations — `src/main/integrations/` e `api-notificacoes/`

| Situação de uso de API (Requisito 3)        | Classe              | Situação  | Responsável |
| ------------------------------------------- | ------------------- | --------- | ----------- |
| 1. Preencher endereço pelo CEP (ViaCEP)     | `ViaCepClient`      | A fazer   | Pessoa 3    |
| 2. Alerta de clima ao confirmar reserva     | `ClimaClient`       | A fazer   | Pessoa 3    |
| 3. Rota até o cliente com devolução atrasada| `RotasClient`       | A fazer   | Pessoa 3    |
| 4. Lembrete de devolução e aviso de multa (API própria) | `NotificacaoClient` + `api-notificacoes/` | Pronto | Pessoa 1 |

A **API própria** é um servidor Express em TypeScript (`npm run api:notificacoes`), só em
`127.0.0.1`, protegido por chave. Detalhes em [`api-notificacoes/README.md`](../api-notificacoes/README.md).

### 3.9 Segurança e configuração — `src/main/security/` e `src/main/config/`

| Classe                  | Papel                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| `EndurecimentoElectron` | Janela isolada, permissões negadas, bloqueio de navegação e downloads     |
| `PoliticaOrigem`        | Diz se uma URL é a nossa tela e quais sites externos podem abrir         |
| `Sessao`                | Guarda quem está logado (no Main, nunca na tela)                         |
| `Configuracao`          | Lê e valida o `.env` (banco e API de notificações)                       |

### 3.10 Composição — `src/main/main.ts`

A classe `Aplicacao` cria tudo **uma vez** e entrega cada objeto a quem precisa
(injeção de dependência pelo construtor):

```ts
const db = new Database(config.banco());
const servico = new NotificacaoService(criarRepositorios(db), new NotificacaoClient(config.notificacoes()));
registrarNotificacoesIpc(registro, servico);
registro.ativar();
```

---

## 4. Testes

Vitest, espelhando as pastas de `src/`. `npm test` roda tudo; os testes que precisam do MySQL
só rodam com `DB_TESTE=1 npm test`.

| O que é testado                       | Como                                                       |
| ------------------------------------- | ---------------------------------------------------------- |
| Repositórios                          | Banco falso que registra o SQL (unidade) + MySQL real numa transação desfeita (integração) |
| Canais, permissões, preload           | Electron substituído por versões de mentira                |
| API de notificações                   | Servidor de verdade numa porta livre, chamado por HTTP     |
| `NotificacaoClient`                   | `fetch` de mentira (inclui API fora do ar e tempo esgotado)|
| Configuração, sessão, política de origem | Unidade                                                 |

---

## 5. Dicionário de dados

Banco `aluguel_esportivo`, MySQL 8 (compatível com MariaDB 10.4+), motor **InnoDB**, charset
**utf8mb4**. Criado por `src/main/database/migrations/001_criar_tabelas.sql`.

Convenções usadas em todas as tabelas:

- `id` — `INT UNSIGNED`, chave primária, `AUTO_INCREMENT`.
- `created_at` / `updated_at` — `DATETIME`, preenchidos pelo próprio banco
  (`updated_at` muda sozinho a cada UPDATE).
- Dinheiro em `DECIMAL(10,2)`; datas sem hora em `DATE`; "sim/não" em `TINYINT(1)`.
- No código, os nomes viram camelCase (`data_retirada` → `dataRetirada`).

Legenda: **PK** chave primária · **FK** chave estrangeira · **UK** valor único · **Nulo** = aceita vazio.

### 5.1 `usuarios` — quem usa o sistema

| Coluna         | Tipo                          | Nulo | Padrão        | Descrição                                   |
| -------------- | ----------------------------- | ---- | ------------- | ------------------------------------------- |
| `id`           | INT UNSIGNED                  | não  | auto          | PK                                          |
| `nome`         | VARCHAR(100)                  | não  |               | Nome de quem usa o sistema                  |
| `email`        | VARCHAR(150)                  | não  |               | Login. **UK** `uk_usuarios_email`           |
| `senha_hash`   | CHAR(60)                      | não  |               | Hash bcrypt (nunca a senha em texto)        |
| `perfil`       | ENUM('ADMIN','FUNCIONARIO')   | não  | 'FUNCIONARIO' | Define o que a pessoa pode fazer            |
| `ativo`        | TINYINT(1)                    | não  | 1             | 0 = bloqueado (sem apagar o histórico)      |
| `ultimo_login` | DATETIME                      | sim  |               | Data e hora do último acesso                |
| `created_at`, `updated_at` | DATETIME          | não  | agora         | Controle                                    |

### 5.2 `clientes` — quem aluga

| Coluna        | Tipo         | Nulo | Descrição                                                  |
| ------------- | ------------ | ---- | ---------------------------------------------------------- |
| `id`          | INT UNSIGNED | não  | PK                                                         |
| `nome`        | VARCHAR(120) | não  | Nome completo. Índice `idx_clientes_nome` (busca)          |
| `cpf`         | CHAR(11)     | não  | Só dígitos. **UK** `uk_clientes_cpf`. Dado sensível (LGPD) |
| `telefone`    | VARCHAR(20)  | não  | Com DDD; usado no WhatsApp                                 |
| `email`       | VARCHAR(150) | sim  | Usado nas notificações                                     |
| `cep`         | CHAR(8)      | não  | Só dígitos; preenche o endereço pelo ViaCEP                |
| `rua`, `numero`, `bairro`, `cidade` | VARCHAR | não | Endereço                                  |
| `complemento` | VARCHAR(60)  | sim  | Apto, bloco...                                             |
| `uf`          | CHAR(2)      | não  | Sigla do estado                                            |
| `created_at`, `updated_at` | DATETIME | não | Controle                                          |

### 5.3 `categorias` — tipos de equipamento

| Coluna           | Tipo         | Nulo | Padrão | Descrição                                         |
| ---------------- | ------------ | ---- | ------ | ------------------------------------------------- |
| `id`             | INT UNSIGNED | não  | auto   | PK                                                |
| `nome`           | VARCHAR(60)  | não  |        | **UK** `uk_categorias_nome`                       |
| `descricao`      | VARCHAR(255) | sim  |        |                                                   |
| `sensivel_clima` | TINYINT(1)   | não  | 0      | 1 = mostra a previsão do tempo ao reservar        |
| `created_at`, `updated_at` | DATETIME | não | agora | Controle                                    |

### 5.4 `fornecedores` — de quem compramos e quem conserta

| Coluna         | Tipo                           | Nulo | Descrição                                     |
| -------------- | ------------------------------ | ---- | --------------------------------------------- |
| `id`           | INT UNSIGNED                   | não  | PK                                            |
| `razao_social` | VARCHAR(150)                   | não  |                                               |
| `cnpj`         | CHAR(14)                       | não  | Só dígitos. **UK** `uk_fornecedores_cnpj`     |
| `tipo`         | ENUM('COMPRA','MANUTENCAO')    | não  | Índice `idx_fornecedores_tipo`                |
| `contato`      | VARCHAR(100)                   | sim  | Nome da pessoa de contato                     |
| `telefone`     | VARCHAR(20)                    | sim  |                                               |
| `email`        | VARCHAR(150)                   | sim  |                                               |
| `created_at`, `updated_at` | DATETIME           | não  | Controle                                      |

### 5.5 `equipamentos` — o inventário

| Coluna               | Tipo                                                          | Nulo | Padrão       | Descrição                         |
| -------------------- | ------------------------------------------------------------- | ---- | ------------ | --------------------------------- |
| `id`                 | INT UNSIGNED                                                  | não  | auto         | PK                                |
| `nome`               | VARCHAR(120)                                                  | não  |              |                                   |
| `descricao`          | VARCHAR(255)                                                  | sim  |              |                                   |
| `modalidade`         | ENUM('VENDA','LOCACAO')                                       | não  |              | Índice `idx_equipamentos_modalidade` |
| `estado_conservacao` | ENUM('NOVO','MUITO_BOM','MEDIO','REGULAR')                    | não  | 'NOVO'       | Atualizado na devolução/manutenção |
| `status`             | ENUM('DISPONIVEL','RESERVADO','EM_MANUTENCAO','INDISPONIVEL') | não  | 'DISPONIVEL' | Índice `idx_equipamentos_status`  |
| `valor_diaria`       | DECIMAL(10,2)                                                 | sim  |              | Obrigatório se LOCACAO            |
| `preco_venda`        | DECIMAL(10,2)                                                 | sim  |              | Obrigatório se VENDA              |
| `data_aquisicao`     | DATE                                                          | sim  |              |                                   |
| `categoria_id`       | INT UNSIGNED                                                  | não  |              | **FK** → `categorias.id`          |
| `fornecedor_id`      | INT UNSIGNED                                                  | sim  |              | **FK** → `fornecedores.id` (de COMPRA) |
| `created_at`, `updated_at` | DATETIME                                                | não  | agora        | Controle                          |

Regra no banco (`ck_equipamentos_preco`): LOCACAO precisa de `valor_diaria > 0`; VENDA precisa de `preco_venda > 0`.

### 5.6 `reservas` — o aluguel

| Coluna                    | Tipo                                              | Nulo | Padrão          | Descrição                                |
| ------------------------- | ------------------------------------------------- | ---- | --------------- | ---------------------------------------- |
| `id`                      | INT UNSIGNED                                      | não  | auto            | PK                                       |
| `cliente_id`              | INT UNSIGNED                                      | não  |                 | **FK** → `clientes.id`                   |
| `usuario_id`              | INT UNSIGNED                                      | não  |                 | **FK** → `usuarios.id` (quem atendeu)    |
| `data_retirada`           | DATE                                              | não  |                 |                                          |
| `data_devolucao_prevista` | DATE                                              | não  |                 |                                          |
| `data_devolucao_real`     | DATE                                              | sim  |                 | Preenchida na devolução                  |
| `status`                  | ENUM('PENDENTE','ATIVA','DEVOLVIDA','CANCELADA')  | não  | 'PENDENTE'      |                                          |
| `valor_total`             | DECIMAL(10,2)                                     | não  | 0               | Soma das diárias × dias                  |
| `valor_caucao`            | DECIMAL(10,2)                                     | não  | 0               | 0 = sem caução                           |
| `caucao_status`           | ENUM('NAO_APLICAVEL','RETIDA','DEVOLVIDA')        | não  | 'NAO_APLICAVEL' |                                          |
| `observacoes`             | VARCHAR(255)                                      | sim  |                 |                                          |
| `created_at`, `updated_at`| DATETIME                                          | não  | agora           | Controle                                 |

Índices: `idx_reservas_status_prevista` (status, prevista — achar atrasadas) e
`idx_reservas_periodo` (retirada, prevista — checar disponibilidade).
Regras no banco: `ck_reservas_datas` (devolução prevista ≥ retirada) e `ck_reservas_valores` (valores ≥ 0).

### 5.7 `itens_reserva` — equipamentos de cada reserva (liga reservas ↔ equipamentos)

| Coluna             | Tipo                                       | Nulo | Descrição                                        |
| ------------------ | ------------------------------------------ | ---- | ------------------------------------------------ |
| `id`               | INT UNSIGNED                               | não  | PK                                               |
| `reserva_id`       | INT UNSIGNED                               | não  | **FK** → `reservas.id` (**CASCADE**: apaga junto) |
| `equipamento_id`   | INT UNSIGNED                               | não  | **FK** → `equipamentos.id`                       |
| `valor_diaria`     | DECIMAL(10,2)                              | não  | Copiada do equipamento na hora (preço "congelado") |
| `estado_retirada`  | ENUM('NOVO','MUITO_BOM','MEDIO','REGULAR') | não  | Como saiu                                        |
| `estado_devolucao` | ENUM('NOVO','MUITO_BOM','MEDIO','REGULAR') | sim  | Como voltou                                      |
| `created_at`, `updated_at` | DATETIME                           | não  | Controle                                         |

**UK** `uk_itens_reserva_equip` (reserva_id, equipamento_id): o mesmo item não entra duas vezes na
mesma reserva. Regra: `ck_itens_reserva_valor` (diária > 0).

### 5.8 `manutencoes` — consertos e revisões

| Coluna           | Tipo                                       | Nulo | Descrição                                  |
| ---------------- | ------------------------------------------ | ---- | ------------------------------------------ |
| `id`             | INT UNSIGNED                               | não  | PK                                         |
| `equipamento_id` | INT UNSIGNED                               | não  | **FK** → `equipamentos.id`                 |
| `fornecedor_id`  | INT UNSIGNED                               | não  | **FK** → `fornecedores.id` (de MANUTENCAO) |
| `tipo`           | ENUM('PREVENTIVA','CORRETIVA')             | não  |                                            |
| `descricao`      | VARCHAR(255)                               | não  | O que foi feito                            |
| `data_envio`     | DATE                                       | não  |                                            |
| `data_retorno`   | DATE                                       | sim  | Vazia = ainda em manutenção                |
| `custo`          | DECIMAL(10,2)                              | sim  |                                            |
| `estado_retorno` | ENUM('NOVO','MUITO_BOM','MEDIO','REGULAR') | sim  | Como voltou                                |
| `created_at`, `updated_at` | DATETIME                         | não  | Controle                                   |

Índices: `idx_manutencoes_equip_retorno`, `idx_manutencoes_fornecedor`.
Regras: `ck_manutencoes_datas` (retorno ≥ envio) e `ck_manutencoes_custo` (custo ≥ 0).

### 5.9 `multas` — cobrança por atraso

| Coluna          | Tipo          | Nulo | Padrão | Descrição                                        |
| --------------- | ------------- | ---- | ------ | ------------------------------------------------ |
| `id`            | INT UNSIGNED  | não  | auto   | PK                                               |
| `reserva_id`    | INT UNSIGNED  | não  |        | **FK** → `reservas.id`. **UK**: no máximo 1 multa por reserva |
| `dias_atraso`   | INT UNSIGNED  | não  |        |                                                  |
| `valor`         | DECIMAL(10,2) | não  |        |                                                  |
| `quitada`       | TINYINT(1)    | não  | 0      | Índice `idx_multas_quitada`                      |
| `data_quitacao` | DATETIME      | sim  |        |                                                  |
| `created_at`, `updated_at` | DATETIME | não | agora | Controle                                    |

Regra: `ck_multas_valores` (dias > 0 e valor ≥ 0).

### 5.10 `pagamentos` — dinheiro recebido

| Coluna       | Tipo                              | Nulo | Padrão | Descrição                                   |
| ------------ | --------------------------------- | ---- | ------ | ------------------------------------------- |
| `id`         | INT UNSIGNED                      | não  | auto   | PK                                          |
| `reserva_id` | INT UNSIGNED                      | não  |        | **FK** → `reservas.id`                      |
| `multa_id`   | INT UNSIGNED                      | sim  |        | **FK** → `multas.id` (só quando tipo MULTA) |
| `tipo`       | ENUM('ALUGUEL','CAUCAO','MULTA')  | não  |        |                                             |
| `forma`      | ENUM('DINHEIRO','PIX','CARTAO')   | não  |        |                                             |
| `valor`      | DECIMAL(10,2)                     | não  |        |                                             |
| `data`       | DATETIME                          | não  | agora  | Quando foi pago                             |
| `created_at`, `updated_at` | DATETIME            | não  | agora  | Controle                                    |

Índices: `idx_pagamentos_reserva_tipo`, `idx_pagamentos_multa`. Regra: `ck_pagamentos_valor` (valor > 0).

### 5.11 Tabela de controle: `schema_migrations`

Criada pelo `Migrator`. Guarda o nome de cada script já aplicado (`nome`, `aplicada_em`), para nunca
rodar a mesma migration duas vezes.

### 5.12 Resumo das chaves estrangeiras

| De                              | Para               | Ao apagar o "pai" | Por quê                                              |
| ------------------------------- | ------------------ | ----------------- | ---------------------------------------------------- |
| `equipamentos.categoria_id`     | `categorias`       | RESTRICT          | Não some categoria em uso                             |
| `equipamentos.fornecedor_id`    | `fornecedores`     | SET NULL          | O item continua existindo sem o fornecedor            |
| `reservas.cliente_id`           | `clientes`         | RESTRICT          | Histórico financeiro não pode sumir                   |
| `reservas.usuario_id`           | `usuarios`         | RESTRICT          | Sabe-se sempre quem atendeu (desativar em vez de apagar) |
| `itens_reserva.reserva_id`      | `reservas`         | **CASCADE**       | Item não faz sentido sem a reserva                    |
| `itens_reserva.equipamento_id`  | `equipamentos`     | RESTRICT          | Não apaga equipamento com histórico                   |
| `manutencoes.equipamento_id`    | `equipamentos`     | RESTRICT          | Idem                                                  |
| `manutencoes.fornecedor_id`     | `fornecedores`     | RESTRICT          | Idem                                                  |
| `multas.reserva_id`             | `reservas`         | RESTRICT          | Idem                                                  |
| `pagamentos.reserva_id`         | `reservas`         | RESTRICT          | Idem                                                  |
| `pagamentos.multa_id`           | `multas`           | RESTRICT          | Idem                                                  |

Todas usam `ON UPDATE CASCADE`. São **11 chaves estrangeiras** ligando as 10 tabelas
(o requisito pede no mínimo 6 tabelas relacionadas).

### 5.13 Regras que o banco não garante sozinho (ficam nos services)

- O fornecedor de um equipamento precisa ser do tipo **COMPRA**; o de uma manutenção, **MANUTENCAO**.
- Pagamento do tipo **MULTA** precisa de `multa_id`; os outros tipos, não.
- Um equipamento não pode estar em duas reservas PENDENTE/ATIVA no mesmo período
  (`ReservaRepository.equipamentoReservadoNoPeriodo`).
- Transições de status permitidas (ex.: só PENDENTE → ATIVA na retirada).
- Reserva + itens e devolução + multa são gravadas **numa transação** (`db.transacao`).
