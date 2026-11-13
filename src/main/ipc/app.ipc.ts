import { app } from 'electron';
import { IPC } from '@shared/ipc-channels';
import { sucesso } from '@shared/dto/resposta';
import type { AppInfoDTO } from '@shared/dto/app.dto';
import type { StatusBancoDTO } from '@shared/dto/banco.dto';
import type { Database } from '../database/Database';
import { DiagnosticoBanco } from '../database/DiagnosticoBanco';
import type { RegistroIpc } from './registrarHandlers';

export interface DependenciasApp {
  /** `null` quando o .env está incompleto; nesse caso `erroBanco` explica o motivo. */
  db: Database | null;
  nomeBanco: string;
  erroBanco: string | null;
}

/** Canais `app:*`: informações do app e situação do banco (tela inicial). */
export function registrarAppIpc(
  registro: RegistroIpc,
  { db, nomeBanco, erroBanco }: DependenciasApp
): void {
  registro.registrar<AppInfoDTO>(IPC.app.info, async () =>
    sucesso({
      nome: app.getName(),
      versao: app.getVersion(),
      electron: process.versions.electron,
      plataforma: process.platform
    })
  );

  registro.registrar<StatusBancoDTO>(IPC.app.statusBanco, async () => {
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
          'Não foi possível acessar o banco. Verifique se o MySQL está rodando, o .env e se as tabelas já foram criadas.'
      });
    }
  });
}
