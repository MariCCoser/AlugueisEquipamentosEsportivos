# Instalador do Windows

Como gerar o instalador da **Locadora Esportiva** e como instalar e configurar o app num computador da loja.
Responsável: Pessoa 4. Decisões de segurança do instalador: [`SEGURANCA.md`, seção 7.6](SEGURANCA.md#76-instalador-electron-builder).

## 1. Gerar o instalador (no computador do grupo)

```bash
npm install
npm run dist
```

O `npm run dist` confere os tipos, compila o app (`electron-vite build`) e roda o **electron-builder** com a configuração de [`electron-builder.yml`](../electron-builder.yml).

Resultado em `release/<versão>/`:

| Arquivo | Para que serve |
|---|---|
| `Locadora Esportiva Setup 0.1.0.exe` | O instalador para entregar. |
| `win-unpacked/` | O app já "instalado" numa pasta, para testar sem instalar (`Locadora Esportiva.exe`). |

- Para gerar só a pasta, mais rápido: `npm run dist:pasta`.
- Na primeira vez, o electron-builder baixa o Electron e o NSIS para o cache (precisa de internet).
- A pasta `release/` está no `.gitignore`: o instalador **não vai para o GitHub**. Para entregar, anexe o `.exe` numa *Release* do GitHub ou mande o arquivo.

## 2. Instalar

1. Abra `Locadora Esportiva Setup 0.1.0.exe`.
2. O Windows SmartScreen pode avisar que o editor é desconhecido (o instalador não tem certificado pago). Clique em **Mais informações** → **Executar assim mesmo**.
3. Escolha a pasta (o padrão não pede administrador) e conclua.
4. O instalador cria atalhos na **Área de Trabalho** e no **Menu Iniciar**.

## 3. Configurar o banco (uma vez por computador)

O app instalado **não traz** o `.env` com a senha do banco: cada loja tem o seu. Antes de usar:

1. Instale e ligue o MySQL/MariaDB (ex.: XAMPP) e crie o banco com os comandos do projeto (`npm run db:setup` e `npm run db:seed`, no computador que tem o código) ou peça ao grupo o banco pronto.
2. Crie a pasta `%APPDATA%\Locadora Esportiva\` (cole esse caminho na barra do Explorador de Arquivos; se a pasta não existir, abra o app uma vez e feche, que ela é criada).
3. Copie para ela o modelo `.env.example`, que fica na pasta do programa, em `resources\.env.example`, e **renomeie para `.env`**.
4. Preencha `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` e a chave `NOTIFICACOES_CHAVE`. As variáveis `DB_ADMIN_*` não são usadas pelo app (só pelos comandos `npm run db:*`) e podem ficar vazias.
5. Abra o app e confira em **Painel → Ver status do sistema e do banco**.

O app procura o `.env` nesta ordem (ver [`LocalArquivoEnv.ts`](../src/main/config/LocalArquivoEnv.ts)):

1. `%APPDATA%\Locadora Esportiva\.env` (recomendado);
2. ao lado do `Locadora Esportiva.exe`.

Se nenhum existir, o app abre normalmente e a tela de status mostra o que está faltando.

## 4. Desinstalar

Pelo **Configurações do Windows → Aplicativos** ou pelo atalho de desinstalação. A pasta `%APPDATA%\Locadora Esportiva\` (com o `.env`) **continua lá** de propósito, para reinstalar sem configurar de novo. Para apagar tudo, remova essa pasta à mão.
