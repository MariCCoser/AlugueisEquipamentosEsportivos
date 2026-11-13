import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import { Configuracao } from './config/Configuracao';
import { Database } from './database/Database';
import { NotificacaoClient } from './integrations/NotificacaoClient';
import { registrarAppIpc, type DependenciasApp } from './ipc/app.ipc';
import { registrarNotificacoesIpc } from './ipc/notificacoes.ipc';
import { RegistroIpc } from './ipc/registrarHandlers';
import { criarRepositorios } from './repositories';
import { NotificacaoService } from './services/NotificacaoService';
import { EndurecimentoElectron } from './security/EndurecimentoElectron';
import { PoliticaOrigem } from './security/PoliticaOrigem';
import { Sessao } from './security/Sessao';

const DEV_SERVER_URL = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL'];
const ARQUIVO_INDEX = join(__dirname, '../renderer/index.html');
const ARQUIVO_PRELOAD = join(__dirname, '../preload/preload.js');

/** Únicos sites que podem ser abertos no navegador do sistema (ex.: mapa da rota até o cliente). */
const DOMINIOS_EXTERNOS = ['openstreetmap.org', 'google.com'] as const;

class Aplicacao {
  private janela: BrowserWindow | null = null;
  private db: Database | null = null;
  private readonly politica = new PoliticaOrigem(DEV_SERVER_URL, ARQUIVO_INDEX, DOMINIOS_EXTERNOS);
  private readonly seguranca = new EndurecimentoElectron(this.politica);
  private readonly sessao = new Sessao();

  iniciar(): void {
    if (!this.seguranca.aplicarGlobal()) return;

    app.on('second-instance', () => {
      if (!this.janela) return;
      if (this.janela.isMinimized()) this.janela.restore();
      this.janela.focus();
    });

    app.whenReady().then(() => {
      this.seguranca.aplicarSessao();
      this.registrarCanais();
      this.criarJanela();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) this.criarJanela();
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') app.quit();
    });

    app.on('will-quit', () => {
      void this.db?.fechar();
    });
  }

  /**
   * Liga os canais IPC. Cada domínio registra os seus handlers aqui; os canais
   * que ainda não têm handler respondem "ainda não implementado".
   */
  private registrarCanais(): void {
    const registro = new RegistroIpc({
      origemConfiavel: (url) => this.politica.origemConfiavel(url),
      perfilAtual: () => this.sessao.perfilAtual()
    });

    const dependencias = this.criarDependencias();
    registrarAppIpc(registro, dependencias);
    this.registrarNotificacoes(registro, dependencias.db);
    // Próximos domínios: registrarAuthIpc(registro, ...), registrarClientesIpc(registro, ...)

    registro.ativar();
  }

  /** Canais de notificação: precisam do banco (para achar o cliente) e da chave da API no .env. */
  private registrarNotificacoes(registro: RegistroIpc, db: Database | null): void {
    if (!db) return; // sem banco, os canais respondem "ainda não implementado"
    try {
      const cliente = new NotificacaoClient(new Configuracao().notificacoes());
      registrarNotificacoesIpc(registro, new NotificacaoService(criarRepositorios(db), cliente));
    } catch (erro) {
      console.error('[notificacoes]', erro instanceof Error ? erro.message : erro);
    }
  }

  /** Composição: cria os objetos compartilhados uma única vez. */
  private criarDependencias(): DependenciasApp {
    Configuracao.carregarArquivoEnv();
    try {
      const config = new Configuracao().banco();
      this.db = new Database(config);
      return { db: this.db, nomeBanco: config.database, erroBanco: null };
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      console.error('[config]', mensagem);
      return { db: null, nomeBanco: '', erroBanco: mensagem };
    }
  }

  private criarJanela(): void {
    this.janela = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 1024,
      minHeight: 640,
      show: false,
      title: 'Aluguel de Equipamentos Esportivos',
      webPreferences: this.seguranca.preferenciasWeb(ARQUIVO_PRELOAD)
    });

    this.janela.once('ready-to-show', () => this.janela?.show());
    this.janela.on('closed', () => (this.janela = null));

    if (DEV_SERVER_URL) {
      void this.janela.loadURL(DEV_SERVER_URL);
    } else {
      void this.janela.loadFile(ARQUIVO_INDEX);
    }
  }
}

new Aplicacao().iniciar();
