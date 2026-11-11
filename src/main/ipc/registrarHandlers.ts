import { app, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { IPC, type CanalIpc } from '@shared/ipc-channels';
import { falha, sucesso, type Resposta } from '@shared/dto/resposta';
import type { AppInfoDTO } from '@shared/dto/app.dto';
import type { StatusBancoDTO } from '@shared/dto/banco.dto';
import type { Database } from '../database/Database';
import { DiagnosticoBanco } from '../database/DiagnosticoBanco';

type Handler<T> = (evento: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Resposta<T>>;

/** Objetos criados uma vez no main.ts e entregues aos handlers. */
export interface Dependencias {
  /** null quando o .env está incompleto; nesse caso `erroBanco` explica o motivo. */
  db: Database | null;
  nomeBanco: string;
  erroBanco: string | null;
}

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

  registrarTodos({ db, nomeBanco, erroBanco }: Dependencias): void {
    this.registrar<AppInfoDTO>(IPC.app.info, async () =>
      sucesso({
        nome: app.getName(),
        versao: app.getVersion(),
        electron: process.versions.electron,
        plataforma: process.platform
      })
    );
    this.registrar<StatusBancoDTO>(IPC.app.statusBanco, async () => {
      if (!db) {
        return sucesso({ conectado: false, mensagem: erroBanco ?? 'Banco não configurado.' });
      }
      try {
        const tabelas = await new DiagnosticoBanco(db).contarRegistros();
        return sucesso({ conectado: true, banco: nomeBanco, tabelas });
      } catch (erro) {
        console.error('[banco]', erro);
        return sucesso({
          conectado: false,
          mensagem:
            'Não foi possível acessar o banco. Verifique se o MySQL está rodando, o .env e se já rodou npm run db:setup.'
        });
      }
    });
    // Próximos domínios: registrarAuthIpc(this, ...), registrarClientesIpc(this, ...) etc.
  }
}
