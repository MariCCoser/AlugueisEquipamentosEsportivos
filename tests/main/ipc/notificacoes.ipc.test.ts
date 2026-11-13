import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { NaoEncontradoError } from '../../../src/main/errors/ErroApp';
import type { NotificacaoService } from '../../../src/main/services/NotificacaoService';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));
const { RegistroIpc } = await import('../../../src/main/ipc/registrarHandlers');
const { registrarNotificacoesIpc } = await import('../../../src/main/ipc/notificacoes.ipc');

const evento = { senderFrame: { url: 'app://tela' } } as unknown as IpcMainInvokeEvent;

function montar() {
  const servico = {
    enviarLembrete: vi.fn(async (reservaId: number) => ({ id: `lembrete-${reservaId}` })),
    enviarAvisoMulta: vi.fn(async () => {
      throw new NaoEncontradoError('Multa não encontrada.');
    })
  };
  const registro = new RegistroIpc({
    origemConfiavel: () => true,
    perfilAtual: () => 'FUNCIONARIO'
  });
  registrarNotificacoesIpc(registro, servico as unknown as NotificacaoService);
  return { registro, servico };
}

describe('canais notificacoes:*', () => {
  it('enviarLembrete passa o reservaId para o service', async () => {
    const { registro } = montar();
    const resposta = await registro.atender('notificacoes:enviarLembrete', evento, {
      reservaId: 3
    });
    expect(resposta).toEqual({ ok: true, dados: { id: 'lembrete-3' } });
  });

  it('entrada inválida vira erro de VALIDACAO sem chamar o service', async () => {
    const { registro, servico } = montar();
    for (const entrada of [
      undefined,
      null,
      {},
      { reservaId: '3' },
      { reservaId: -1 },
      { reservaId: 1.5 }
    ]) {
      const resposta = await registro.atender('notificacoes:enviarLembrete', evento, entrada);
      expect(resposta).toMatchObject({ ok: false, erro: { codigo: 'VALIDACAO' } });
    }
    expect(servico.enviarLembrete).not.toHaveBeenCalled();
  });

  it('erro esperado do service chega na tela com a mensagem amigável', async () => {
    const { registro } = montar();
    const resposta = await registro.atender('notificacoes:enviarAvisoMulta', evento, {
      multaId: 9
    });
    expect(resposta).toEqual({
      ok: false,
      erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Multa não encontrada.' }
    });
  });
});
