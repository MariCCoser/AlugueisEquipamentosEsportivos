import type { IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Perfil } from '../../../src/shared/models/enums';
import { sucesso } from '../../../src/shared/dto/resposta';
import { TODOS_OS_CANAIS } from '../../../src/shared/ipc-channels';

// O Electron não roda dentro do Vitest; trocamos o ipcMain por uma versão de mentira.
const canaisLigados: string[] = [];
vi.mock('electron', () => ({
  ipcMain: { handle: (canal: string) => canaisLigados.push(canal) }
}));

const { RegistroIpc } = await import('../../../src/main/ipc/registrarHandlers');

const URL_DA_TELA = 'app://tela';

/** Monta um evento como se viesse da tela `url`. */
function eventoDe(url = URL_DA_TELA): IpcMainInvokeEvent {
  return { senderFrame: { url } } as unknown as IpcMainInvokeEvent;
}

function montar(perfil: Perfil | null = null) {
  return new RegistroIpc({
    origemConfiavel: (url) => url === URL_DA_TELA,
    perfilAtual: () => perfil
  });
}

beforeEach(() => {
  canaisLigados.length = 0;
});

describe('RegistroIpc', () => {
  it('ativar liga todos os canais no Electron, mesmo os que ainda não têm handler', () => {
    const registro = montar();
    registro.registrar('app:info', async () => sucesso('ok'));
    registro.ativar();
    expect(canaisLigados.sort()).toEqual([...TODOS_OS_CANAIS].sort());
    expect(registro.canaisPendentes()).not.toContain('app:info');
    expect(registro.canaisPendentes()).toHaveLength(TODOS_OS_CANAIS.length - 1);
  });

  it('recusa chamada de origem desconhecida, mesmo em canal público', async () => {
    const registro = montar();
    const handler = vi.fn(async () => sucesso('ok'));
    registro.registrar('app:info', handler);

    const resposta = await registro.atender(
      'app:info',
      eventoDe('https://site-malicioso.com'),
      undefined
    );

    expect(resposta).toMatchObject({ ok: false, erro: { codigo: 'NAO_AUTORIZADO' } });
    expect(handler).not.toHaveBeenCalled();
  });

  it('canal público funciona sem login', async () => {
    const registro = montar(null);
    registro.registrar('app:info', async () => sucesso('ok'));
    expect(await registro.atender('app:info', eventoDe(), undefined)).toEqual(sucesso('ok'));
  });

  it('canal LOGADO pede login', async () => {
    const registro = montar(null);
    registro.registrar('clientes:listar', async () => sucesso([]));
    const resposta = await registro.atender('clientes:listar', eventoDe(), undefined);
    expect(resposta).toMatchObject({ ok: false, erro: { mensagem: 'Faça login para continuar.' } });
  });

  it('canal ADMIN recusa funcionário e aceita administrador', async () => {
    const handler = async () => sucesso('excluído');

    const comoFuncionario = montar('FUNCIONARIO');
    comoFuncionario.registrar('clientes:excluir', handler);
    expect(await comoFuncionario.atender('clientes:excluir', eventoDe(), { id: 1 })).toMatchObject({
      ok: false,
      erro: { codigo: 'NAO_AUTORIZADO' }
    });

    const comoAdmin = montar('ADMIN');
    comoAdmin.registrar('clientes:excluir', handler);
    expect(await comoAdmin.atender('clientes:excluir', eventoDe(), { id: 1 })).toEqual(
      sucesso('excluído')
    );
  });

  it('entrega a entrada da tela para o handler', async () => {
    const registro = montar('FUNCIONARIO');
    const handler = vi.fn(async (entrada: unknown) => sucesso(entrada));
    registro.registrar('clientes:buscarPorId', handler);
    await registro.atender('clientes:buscarPorId', eventoDe(), { id: 3 });
    expect(handler).toHaveBeenCalledWith({ id: 3 }, expect.anything());
  });

  it('canal sem handler responde "ainda não implementada"', async () => {
    const resposta = await montar('ADMIN').atender('dashboard:resumo', eventoDe(), undefined);
    expect(resposta).toMatchObject({
      ok: false,
      erro: { codigo: 'INTERNO', mensagem: 'Esta função ainda não foi implementada.' }
    });
  });

  it('erro inesperado vira mensagem amigável, sem detalhes técnicos', async () => {
    const registro = montar('ADMIN');
    registro.registrar('dashboard:resumo', async () => {
      throw new Error("ER_PARSE_ERROR near 'SELECT * FROM'");
    });
    const silenciar = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const resposta = await registro.atender('dashboard:resumo', eventoDe(), undefined);

    expect(resposta).toEqual({
      ok: false,
      erro: { codigo: 'INTERNO', mensagem: 'Erro inesperado. Tente novamente.' }
    });
    silenciar.mockRestore();
  });

  it('não deixa registrar o mesmo canal duas vezes nem depois de ativar', () => {
    const registro = montar();
    registro.registrar('app:info', async () => sucesso(1));
    expect(() => registro.registrar('app:info', async () => sucesso(2))).toThrow('duas vezes');
    registro.ativar();
    expect(() => registro.registrar('app:statusBanco', async () => sucesso(3))).toThrow(
      'antes de chamar ativar()'
    );
  });
});
