import { IPC } from '@shared/ipc-channels';
import { sucesso } from '@shared/dto/resposta';
import type { NotificacaoDTO } from '@shared/dto/notificacao.dto';
import { ValidacaoError } from '../errors/ErroApp';
import type { NotificacaoService } from '../services/NotificacaoService';
import type { RegistroIpc } from './registrarHandlers';

/**
 * Lê um id positivo de dentro da entrada que veio da tela.
 * Ex.: idDe({ reservaId: 3 }, 'reservaId') -> 3
 */
function idDe(entrada: unknown, campo: string): number {
  const valor = (entrada as Record<string, unknown> | null)?.[campo];
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
    throw new ValidacaoError(`Informe um ${campo} válido.`);
  }
  return valor;
}

/** Canais `notificacoes:*` (API 4 — nossa API de notificações). */
export function registrarNotificacoesIpc(registro: RegistroIpc, servico: NotificacaoService): void {
  registro.registrar<NotificacaoDTO>(IPC.notificacoes.enviarLembrete, async (entrada) =>
    sucesso(await servico.enviarLembrete(idDe(entrada, 'reservaId')))
  );

  registro.registrar<NotificacaoDTO>(IPC.notificacoes.enviarAvisoMulta, async (entrada) =>
    sucesso(await servico.enviarAvisoMulta(idDe(entrada, 'multaId')))
  );
}
