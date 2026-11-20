import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import type { Perfil } from '../../../src/shared/models/enums';
import type { DashboardService } from '../../../src/main/services/DashboardService';

// O Electron não roda dentro do Vitest; trocamos o ipcMain por uma versão de mentira.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));

const { RegistroIpc } = await import('../../../src/main/ipc/registrarHandlers');
const { registrarDashboardIpc } = await import('../../../src/main/ipc/dashboard.ipc');

const URL_DA_TELA = 'app://tela';
const evento = { senderFrame: { url: URL_DA_TELA } } as unknown as IpcMainInvokeEvent;

function montar(perfil: Perfil | null) {
  const registro = new RegistroIpc({
    origemConfiavel: (url) => url === URL_DA_TELA,
    perfilAtual: () => perfil
  });
  const service = { resumo: vi.fn(async () => ({ reservasAtivas: 1 })) };
  registrarDashboardIpc(registro, service as unknown as DashboardService);
  return { registro, service };
}

describe('canal dashboard:resumo', () => {
  it('qualquer usuário logado vê o resumo', async () => {
    const { registro } = montar('FUNCIONARIO');
    expect(await registro.atender('dashboard:resumo', evento, undefined)).toEqual({
      ok: true,
      dados: { reservasAtivas: 1 }
    });
  });

  it('sem login, o resumo não é entregue', async () => {
    const { registro, service } = montar(null);
    const resposta = await registro.atender('dashboard:resumo', evento, undefined);
    expect(resposta).toMatchObject({ ok: false, erro: { codigo: 'NAO_AUTORIZADO' } });
    expect(service.resumo).not.toHaveBeenCalled();
  });

  it('falha do banco vira mensagem genérica, sem detalhes técnicos', async () => {
    const { registro, service } = montar('ADMIN');
    service.resumo.mockRejectedValueOnce(new Error("Table 'multas' doesn't exist"));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const resposta = await registro.atender('dashboard:resumo', evento, undefined);
    expect(resposta).toEqual({
      ok: false,
      erro: { codigo: 'INTERNO', mensagem: 'Erro inesperado. Tente novamente.' }
    });
  });
});
