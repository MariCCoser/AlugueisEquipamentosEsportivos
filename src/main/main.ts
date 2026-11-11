import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import { Configuracao } from './config/Configuracao';
import { Database } from './database/Database';
import { RegistroIpc, type Dependencias } from './ipc/registrarHandlers';
import { EndurecimentoElectron } from './security/EndurecimentoElectron';
import { PoliticaOrigem } from './security/PoliticaOrigem';

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

  iniciar(): void {
    if (!this.seguranca.aplicarGlobal()) return;

    app.on('second-instance', () => {
      if (!this.janela) return;
      if (this.janela.isMinimized()) this.janela.restore();
      this.janela.focus();
    });

    app.whenReady().then(() => {
      this.seguranca.aplicarSessao();
      new RegistroIpc((url) => this.politica.origemConfiavel(url)).registrarTodos(
        this.criarDependencias()
      );
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

  /** Composição: cria os objetos compartilhados uma única vez. */
  private criarDependencias(): Dependencias {
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
