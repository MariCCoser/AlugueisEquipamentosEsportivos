import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, shell } from 'electron';
import { Configuracao } from './config/Configuracao';
import { Database } from './database/Database';
import { RegistroIpc, type Dependencias } from './ipc/registrarHandlers';

const DEV_SERVER_URL = process.env['ELECTRON_RENDERER_URL'];
const ARQUIVO_INDEX = join(__dirname, '../renderer/index.html');

/** Só aceita páginas do próprio app: o servidor do Vite (dev) ou o index.html empacotado. */
function origemConfiavel(url: string): boolean {
  if (DEV_SERVER_URL) return url.startsWith(DEV_SERVER_URL);
  return url === pathToFileURL(ARQUIVO_INDEX).toString();
}

class Aplicacao {
  private janela: BrowserWindow | null = null;
  private db: Database | null = null;

  iniciar(): void {
    app.whenReady().then(() => {
      new RegistroIpc(origemConfiavel).registrarTodos(this.criarDependencias());
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

    // Nenhuma janela pode navegar para fora do app nem abrir pop-ups.
    app.on('web-contents-created', (_evento, contents) => {
      contents.on('will-navigate', (evento, url) => {
        if (!origemConfiavel(url)) evento.preventDefault();
      });
      contents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://')) void shell.openExternal(url);
        return { action: 'deny' };
      });
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
      webPreferences: {
        preload: join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true
      }
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
