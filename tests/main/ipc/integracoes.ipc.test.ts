import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import type { Perfil } from '../../../src/shared/models/enums';
import { IntegracaoError, NaoEncontradoError } from '../../../src/main/errors/ErroApp';

// O Electron não roda dentro do Vitest; trocamos o ipcMain por uma versão de mentira.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));

const { RegistroIpc } = await import('../../../src/main/ipc/registrarHandlers');
const { registrarIntegracoesIpc } = await import('../../../src/main/ipc/integracoes.ipc');

const URL_DA_TELA = 'app://tela';
const evento = { senderFrame: { url: URL_DA_TELA } } as unknown as IpcMainInvokeEvent;

function montar(perfil: Perfil | null = 'FUNCIONARIO') {
  const registro = new RegistroIpc({
    origemConfiavel: (url) => url === URL_DA_TELA,
    perfilAtual: () => perfil
  });
  const s = {
    cep: {
      buscar: vi.fn(async (cep: string) => ({ cep, rua: 'R', bairro: 'B', cidade: 'C', uf: 'SP' }))
    },
    clima: { prever: vi.fn(async () => ({ alerta: false })) },
    rotas: { calcular: vi.fn(async () => ({ distanciaKm: 1 })) }
  };
  registrarIntegracoesIpc(registro, s as never);
  return { registro, s };
}

describe('canais integracoes:*', () => {
  it('registra os 3 canais', () => {
    const { registro } = montar();
    expect(registro.canaisPendentes().filter((c) => c.startsWith('integracoes:'))).toEqual([]);
  });

  it('exigem login', async () => {
    const { registro, s } = montar(null);
    const resposta = await registro.atender('integracoes:buscarCep', evento, { cep: '01310100' });
    expect(resposta).toMatchObject({ ok: false, erro: { codigo: 'NAO_AUTORIZADO' } });
    expect(s.cep.buscar).not.toHaveBeenCalled();
  });

  it('buscarCep aceita o CEP com traço e manda só os dígitos', async () => {
    const { registro, s } = montar();
    expect((await registro.atender('integracoes:buscarCep', evento, { cep: '01310-100' })).ok).toBe(
      true
    );
    expect(s.cep.buscar).toHaveBeenCalledWith('01310100');
  });

  it('CEP com tamanho errado volta no campo cep, sem chamar a API', async () => {
    const { registro, s } = montar();
    const resposta = await registro.atender('integracoes:buscarCep', evento, { cep: '123' });
    expect(resposta).toMatchObject({
      ok: false,
      erro: { codigo: 'VALIDACAO', campos: { cep: 'CEP deve ter 8 dígitos.' } }
    });
    expect(s.cep.buscar).not.toHaveBeenCalled();
  });

  it('CEP inexistente chega na tela com a mensagem amigável', async () => {
    const { registro, s } = montar();
    s.cep.buscar.mockRejectedValueOnce(new NaoEncontradoError('CEP não encontrado.'));
    expect(await registro.atender('integracoes:buscarCep', evento, { cep: '99999999' })).toEqual({
      ok: false,
      erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'CEP não encontrado.' }
    });
  });

  it('previsaoClima valida cidade, UF, data e equipamentos', async () => {
    const { registro, s } = montar();
    const ok = await registro.atender('integracoes:previsaoClima', evento, {
      cidade: ' Florianópolis ',
      uf: 'sc',
      data: '2026-11-22',
      equipamentoIds: [1, 2]
    });
    expect(ok.ok).toBe(true);
    expect(s.clima.prever).toHaveBeenCalledWith({
      cidade: 'Florianópolis',
      uf: 'SC',
      data: '2026-11-22',
      equipamentoIds: [1, 2]
    });

    const ruim = await registro.atender('integracoes:previsaoClima', evento, {
      cidade: '',
      uf: 'Santa Catarina',
      data: '2026-02-30',
      equipamentoIds: []
    });
    expect(Object.keys((ruim as { erro: { campos: object } }).erro.campos).sort()).toEqual([
      'cidade',
      'data',
      'equipamentoIds',
      'uf'
    ]);
  });

  it('falha da API de clima vira INTEGRACAO (a tela mostra "Previsão indisponível")', async () => {
    const { registro, s } = montar();
    s.clima.prever.mockRejectedValueOnce(new IntegracaoError('O serviço demorou demais.'));
    const resposta = await registro.atender('integracoes:previsaoClima', evento, {
      cidade: 'Curitiba',
      uf: 'PR',
      data: '2026-11-22',
      equipamentoIds: [1]
    });
    expect(resposta).toMatchObject({ ok: false, erro: { codigo: 'INTEGRACAO' } });
  });

  it('calcularRota exige um clienteId válido', async () => {
    const { registro, s } = montar();
    expect((await registro.atender('integracoes:calcularRota', evento, { clienteId: 3 })).ok).toBe(
      true
    );
    expect(s.rotas.calcular).toHaveBeenCalledWith(3);
    const ruim = await registro.atender('integracoes:calcularRota', evento, { clienteId: 'x' });
    expect(ruim).toMatchObject({ ok: false, erro: { codigo: 'VALIDACAO' } });
  });
});
