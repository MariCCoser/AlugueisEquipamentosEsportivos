import { app, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { IPC, type CanalIpc } from '@shared/ipc-channels';
import { falha, sucesso, type Resposta } from '@shared/dto/resposta';
import type { AppInfoDTO } from '@shared/dto/app.dto';

type Handler<T> = (evento: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Resposta<T>>;

/**
 * Registro central dos handlers IPC.
 * Todo handler passa pela validação do remetente e por um try/catch que
 * converte exceções inesperadas em `Resposta` com erro INTERNO (sem vazar stack trace).
 */
export class RegistroIpc {
  constructor(private readonly origemConfiavel: (url: string) => boolean) {}

  registrar<T>(canal: CanalIpc, handler: Handler<T>): void {
    ipcMain.handle(canal, async (evento, ...args): Promise<Resposta<T>> => {
      const url = evento.senderFrame?.url ?? '';
      if (!this.origemConfiavel(url)) {
        return falha('NAO_AUTORIZADO', 'Origem da requisição não permitida.');
      }
      try {
        return await handler(evento, ...args);
      } catch (erro) {
        console.error(`[IPC ${canal}]`, erro);
        return falha('INTERNO', 'Erro inesperado. Tente novamente.');
      }
    });
  }

  registrarTodos(): void {
    this.registrar<AppInfoDTO>(IPC.app.info, async () =>
      sucesso({
        nome: app.getName(),
        versao: app.getVersion(),
        electron: process.versions.electron,
        plataforma: process.platform
      })
    );
    // Próximos domínios: registrarAuthIpc(this, ...), registrarClientesIpc(this, ...) etc.
  }
}
