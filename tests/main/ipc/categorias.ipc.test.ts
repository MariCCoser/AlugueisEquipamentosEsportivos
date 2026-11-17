import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import type { Perfil } from '../../../src/shared/models/enums';
import { RegraNegocioError } from '../../../src/main/errors/ErroApp';
import type { CategoriaService } from '../../../src/main/services/CategoriaService';

// O Electron não roda dentro do Vitest; trocamos o ipcMain por uma versão de mentira.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));

const { RegistroIpc } = await import('../../../src/main/ipc/registrarHandlers');
const { registrarCategoriasIpc } = await import('../../../src/main/ipc/categorias.ipc');

const URL_DA_TELA = 'app://tela';
const evento = { senderFrame: { url: URL_DA_TELA } } as unknown as IpcMainInvokeEvent;

function montar(perfil: Perfil | null = 'ADMIN') {
  const registro = new RegistroIpc({
    origemConfiavel: (url) => url === URL_DA_TELA,
    perfilAtual: () => perfil
  });
  const service = {
    criar: vi.fn(async (dados) => ({ id: 1, qtdEquipamentos: 0, ...dados })),
    listar: vi.fn(async () => []),
    buscarPorId: vi.fn(async (id: number) => ({ id })),
    atualizar: vi.fn(async (dados) => dados),
    excluir: vi.fn(async () => undefined)
  };
  registrarCategoriasIpc(registro, service as unknown as CategoriaService);
  return { registro, service };
}

describe('canais categorias:*', () => {
  it('registra os 5 canais de categorias', () => {
    const { registro } = montar();
    expect(registro.canaisPendentes().filter((c) => c.startsWith('categorias:'))).toEqual([]);
  });

  it('valida e limpa os dados antes de chamar o service', async () => {
    const { registro, service } = montar();
    const resposta = await registro.atender('categorias:criar', evento, {
      nome: '  Pranchas ',
      sensivelClima: true,
      id: 99
    });
    expect(resposta.ok).toBe(true);
    expect(service.criar).toHaveBeenCalledWith({
      nome: 'Pranchas',
      descricao: undefined,
      sensivelClima: true
    });
  });

  it('devolve os erros por campo para a tela marcar o formulário', async () => {
    const { registro, service } = montar();
    const resposta = await registro.atender('categorias:criar', evento, { nome: '' });
    expect(resposta).toMatchObject({
      ok: false,
      erro: { codigo: 'VALIDACAO', campos: { nome: 'Nome é obrigatório.' } }
    });
    expect(service.criar).not.toHaveBeenCalled();
  });

  it('FUNCIONARIO pode listar, mas não pode criar, editar nem excluir', async () => {
    const { registro, service } = montar('FUNCIONARIO');
    expect((await registro.atender('categorias:listar', evento, undefined)).ok).toBe(true);

    for (const canal of [
      'categorias:criar',
      'categorias:atualizar',
      'categorias:excluir'
    ] as const) {
      const resposta = await registro.atender(canal, evento, { id: 1, nome: 'Bolas' });
      expect(resposta).toMatchObject({ ok: false, erro: { codigo: 'NAO_AUTORIZADO' } });
    }
    expect(service.criar).not.toHaveBeenCalled();
    expect(service.excluir).not.toHaveBeenCalled();
  });

  it('sem login, nem listar funciona', async () => {
    const { registro } = montar(null);
    const resposta = await registro.atender('categorias:listar', evento, undefined);
    expect(resposta).toMatchObject({ ok: false, erro: { codigo: 'NAO_AUTORIZADO' } });
  });

  it('regra de negócio vira mensagem amigável', async () => {
    const { registro, service } = montar();
    service.excluir.mockRejectedValueOnce(new RegraNegocioError('Categoria em uso.'));
    const resposta = await registro.atender('categorias:excluir', evento, { id: 1 });
    expect(resposta).toEqual({
      ok: false,
      erro: { codigo: 'REGRA_NEGOCIO', mensagem: 'Categoria em uso.' }
    });
  });
});
