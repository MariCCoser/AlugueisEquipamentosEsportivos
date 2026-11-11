import { app, session, shell, type WebContents, type WebPreferences } from 'electron';
import type { PoliticaOrigem } from './PoliticaOrigem';

/**
 * Aplica as proteções do Electron em um lugar só (checklist oficial de segurança do Electron).
 * O main.ts só chama `aplicarGlobal()` antes do app ficar pronto e
 * `aplicarSessao()` depois, e usa `preferenciasWeb()` ao criar janelas.
 *
 * As justificativas de cada item estão em docs/SEGURANCA.md.
 */
export class EndurecimentoElectron {
  constructor(private readonly politica: PoliticaOrigem) {}

  /** Configurações das janelas: Renderer isolado, sem Node e em sandbox. */
  preferenciasWeb(caminhoPreload: string): WebPreferences {
    return {
      preload: caminhoPreload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      experimentalFeatures: false,
      navigateOnDragDrop: false,
      spellcheck: false,
      // DevTools só durante o desenvolvimento; no app instalado ficam desligadas.
      devTools: !app.isPackaged
    };
  }

  /**
   * Deve ser chamado ANTES de `app.whenReady()`.
   * Retorna false se já existe outra instância aberta (o app deve encerrar).
   */
  aplicarGlobal(): boolean {
    // Garante sandbox em todo Renderer, mesmo se alguém esquecer na janela.
    app.enableSandbox();

    // Evita duas instâncias do app (duas sessões de login, dois pools no banco).
    if (!app.requestSingleInstanceLock()) {
      app.quit();
      return false;
    }

    app.on('web-contents-created', (_evento, contents) => this.protegerConteudo(contents));
    return true;
  }

  /** Deve ser chamado DEPOIS de `app.whenReady()`. */
  aplicarSessao(): void {
    const sessao = session.defaultSession;

    // O sistema não usa câmera, microfone, localização, notificações etc.: nega tudo.
    sessao.setPermissionRequestHandler((_conteudo, _permissao, responder) => responder(false));
    sessao.setPermissionCheckHandler(() => false);

    // Nenhum download disparado pela interface.
    sessao.on('will-download', (evento) => evento.preventDefault());
  }

  private protegerConteudo(contents: WebContents): void {
    // Nada de navegar ou ser redirecionado para fora do app.
    const bloquearSeExterno = (evento: Electron.Event, url: string): void => {
      if (!this.politica.origemConfiavel(url)) {
        evento.preventDefault();
        console.warn('[seguranca] navegação bloqueada:', url);
      }
    };
    contents.on('will-navigate', bloquearSeExterno);
    contents.on('will-redirect', bloquearSeExterno);

    // Nenhuma <webview> pode ser criada.
    contents.on('will-attach-webview', (evento) => evento.preventDefault());

    // Pop-ups nunca abrem dentro do app; links permitidos vão para o navegador do sistema.
    contents.setWindowOpenHandler(({ url }) => {
      if (this.politica.podeAbrirExterno(url)) void shell.openExternal(url);
      else console.warn('[seguranca] link externo bloqueado:', url);
      return { action: 'deny' };
    });
  }
}
