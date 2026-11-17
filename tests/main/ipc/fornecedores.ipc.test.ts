import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import type { Perfil } from '../../../src/shared/models/enums';
import type { FornecedorService } from '../../../src/main/services/FornecedorService';

// O Electron não roda dentro do Vitest; trocamos o ipcMain por uma versão de mentira.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));

const { RegistroIpc } = await import('../../../src/main/ipc/registrarHandlers');
const { registrarFornecedoresIpc } = await import('../../../src/main/ipc/fornecedores.ipc');

const URL_DA_TELA = 'app://tela';
const evento = { senderFrame: { url: URL_DA_TELA } } as unknown as IpcMainInvokeEvent;

const valido = {
  razaoSocial: 'Bike Reparos Oficina ME',
  cnpj: '77.889.900/0001-66',
  tipo: 'MANUTENCAO'
};

function montar(perfil: Perfil | null = 'ADMIN') {
  const registro = new RegistroIpc({
    origemConfiavel: (url) => url === URL_DA_TELA,
    perfilAtual: () => perfil
  });
  const service = {
    criar: vi.fn(async (dados) => ({ id: 1, ...dados })),
    listar: vi.fn(async () => []),
    listarPorTipo: vi.fn(async () => []),
    buscarPorId: vi.fn(async (id: number) => ({ id })),
    atualizar: vi.fn(async (dados) => dados),
    excluir: vi.fn(async () => undefined)
  };
  registrarFornecedoresIpc(registro, service as unknown as FornecedorService);
  return { registro, service };
}

describe('canais fornecedores:*', () => {
  it('registra os 6 canais de fornecedores', () => {
    const { registro } = montar();
    expect(registro.canaisPendentes().filter((c) => c.startsWith('fornecedores:'))).toEqual([]);
  });

  it('envia o CNPJ só com dígitos para o service', async () => {
    const { registro, service } = montar();
    expect((await registro.atender('fornecedores:criar', evento, valido)).ok).toBe(true);
    expect(service.criar).toHaveBeenCalledWith(expect.objectContaining({ cnpj: '77889900000166' }));
  });

  it('CNPJ inválido volta como erro do campo', async () => {
    const { registro, service } = montar();
    const resposta = await registro.atender('fornecedores:criar', evento, {
      ...valido,
      cnpj: '77889900000167'
    });
    expect(resposta).toMatchObject({
      ok: false,
      erro: { codigo: 'VALIDACAO', campos: { cnpj: 'CNPJ inválido: confira os números.' } }
    });
    expect(service.criar).not.toHaveBeenCalled();
  });

  it('listarPorTipo valida o tipo', async () => {
    const { registro, service } = montar('FUNCIONARIO');
    expect(
      (await registro.atender('fornecedores:listarPorTipo', evento, { tipo: 'COMPRA' })).ok
    ).toBe(true);
    expect(service.listarPorTipo).toHaveBeenCalledWith('COMPRA');
    const invalido = await registro.atender('fornecedores:listarPorTipo', evento, { tipo: 'X' });
    expect(invalido).toMatchObject({ ok: false, erro: { codigo: 'VALIDACAO' } });
  });

  it('FUNCIONARIO pode listar, mas não pode criar, editar nem excluir', async () => {
    const { registro, service } = montar('FUNCIONARIO');
    expect((await registro.atender('fornecedores:listar', evento, undefined)).ok).toBe(true);
    for (const canal of [
      'fornecedores:criar',
      'fornecedores:atualizar',
      'fornecedores:excluir'
    ] as const) {
      const resposta = await registro.atender(canal, evento, { id: 1, ...valido });
      expect(resposta).toMatchObject({ ok: false, erro: { codigo: 'NAO_AUTORIZADO' } });
    }
    expect(service.criar).not.toHaveBeenCalled();
    expect(service.atualizar).not.toHaveBeenCalled();
    expect(service.excluir).not.toHaveBeenCalled();
  });
});
