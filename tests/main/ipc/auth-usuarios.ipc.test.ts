import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import type { Perfil } from '../../../src/shared/models/enums';
import { NaoAutorizadoError, RegraNegocioError } from '../../../src/main/errors/ErroApp';
import type { AuthService } from '../../../src/main/services/AuthService';
import type { UsuarioService } from '../../../src/main/services/UsuarioService';

// O Electron não roda dentro do Vitest; trocamos o ipcMain por uma versão de mentira.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));

const { RegistroIpc } = await import('../../../src/main/ipc/registrarHandlers');
const { registrarAuthIpc } = await import('../../../src/main/ipc/auth.ipc');
const { registrarUsuariosIpc } = await import('../../../src/main/ipc/usuarios.ipc');

const URL_DA_TELA = 'app://tela';
const evento = { senderFrame: { url: URL_DA_TELA } } as unknown as IpcMainInvokeEvent;

function montar(perfil: Perfil | null = 'ADMIN') {
  const registro = new RegistroIpc({
    origemConfiavel: (url) => url === URL_DA_TELA,
    perfilAtual: () => perfil
  });
  const auth = {
    login: vi.fn(async () => ({ id: 1, nome: 'Admin', email: 'a@b.com', perfil: 'ADMIN' })),
    logout: vi.fn(),
    sessaoAtual: vi.fn(() => null),
    alterarSenha: vi.fn(async () => undefined)
  };
  const usuarios = {
    criar: vi.fn(async (dados: object) => ({ id: 5, ativo: true, ...dados })),
    listar: vi.fn(async () => []),
    buscarPorId: vi.fn(async (id: number) => ({ id })),
    atualizar: vi.fn(async (dados: object) => dados),
    excluir: vi.fn(async () => undefined)
  };
  registrarAuthIpc(registro, auth as unknown as AuthService);
  registrarUsuariosIpc(registro, usuarios as unknown as UsuarioService);
  return { registro, auth, usuarios };
}

describe('canais auth:*', () => {
  it('registra os 4 canais de auth e os 5 de usuarios', () => {
    const { registro } = montar();
    const pendentes = registro
      .canaisPendentes()
      .filter((c) => c.startsWith('auth:') || c.startsWith('usuarios:'));
    expect(pendentes).toEqual([]);
  });

  it('login e sessaoAtual funcionam sem ninguém logado', async () => {
    const { registro, auth } = montar(null);
    expect(await registro.atender('auth:sessaoAtual', evento, undefined)).toEqual({
      ok: true,
      dados: null
    });
    const resposta = await registro.atender('auth:login', evento, {
      email: ' Admin@Aluguel.local ',
      senha: 'Admin@2026'
    });
    expect(resposta.ok).toBe(true);
    expect(auth.login).toHaveBeenCalledWith({ email: 'admin@aluguel.local', senha: 'Admin@2026' });
  });

  it('login com campos vazios devolve erro.campos.email / erro.campos.senha', async () => {
    const { registro, auth } = montar(null);
    const resposta = await registro.atender('auth:login', evento, { email: '', senha: '' });
    expect(resposta).toMatchObject({
      ok: false,
      erro: {
        codigo: 'VALIDACAO',
        campos: { email: expect.any(String), senha: expect.any(String) }
      }
    });
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('senha errada chega na tela como NAO_AUTORIZADO com a mensagem genérica', async () => {
    const { registro, auth } = montar(null);
    auth.login.mockRejectedValueOnce(new NaoAutorizadoError('E-mail ou senha incorretos.'));
    const resposta = await registro.atender('auth:login', evento, {
      email: 'a@b.com',
      senha: 'errada'
    });
    expect(resposta).toEqual({
      ok: false,
      erro: { codigo: 'NAO_AUTORIZADO', mensagem: 'E-mail ou senha incorretos.' }
    });
  });

  it('logout e alterarSenha exigem alguém logado', async () => {
    const { registro, auth } = montar(null);
    for (const canal of ['auth:logout', 'auth:alterarSenha'] as const) {
      const resposta = await registro.atender(canal, evento, {});
      expect(resposta).toMatchObject({ ok: false, erro: { codigo: 'NAO_AUTORIZADO' } });
    }
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('FUNCIONARIO pode trocar a própria senha e sair', async () => {
    const { registro, auth } = montar('FUNCIONARIO');
    const troca = await registro.atender('auth:alterarSenha', evento, {
      senhaAtual: 'Func@2026',
      novaSenha: 'NovaSenha@1'
    });
    expect(troca).toEqual({ ok: true, dados: undefined });
    expect((await registro.atender('auth:logout', evento, undefined)).ok).toBe(true);
    expect(auth.logout).toHaveBeenCalled();
  });
});

describe('canais usuarios:*', () => {
  it('FUNCIONARIO não acessa nenhum canal de usuários', async () => {
    const { registro, usuarios } = montar('FUNCIONARIO');
    for (const canal of [
      'usuarios:criar',
      'usuarios:listar',
      'usuarios:buscarPorId',
      'usuarios:atualizar',
      'usuarios:excluir'
    ] as const) {
      const resposta = await registro.atender(canal, evento, { id: 1 });
      expect(resposta).toMatchObject({ ok: false, erro: { codigo: 'NAO_AUTORIZADO' } });
    }
    expect(usuarios.listar).not.toHaveBeenCalled();
  });

  it('valida antes de criar e descarta campos que a tela não pode mandar', async () => {
    const { registro, usuarios } = montar();
    const resposta = await registro.atender('usuarios:criar', evento, {
      nome: ' Rita ',
      email: 'Rita@Loja.com',
      senha: 'Senha@123',
      perfil: 'FUNCIONARIO',
      senhaHash: 'tentativa',
      ativo: false
    });
    expect(resposta.ok).toBe(true);
    expect(usuarios.criar).toHaveBeenCalledWith({
      nome: 'Rita',
      email: 'rita@loja.com',
      senha: 'Senha@123',
      perfil: 'FUNCIONARIO'
    });
  });

  it('senha curta volta como erro no campo senha', async () => {
    const { registro } = montar();
    const resposta = await registro.atender('usuarios:criar', evento, {
      nome: 'Rita',
      email: 'rita@loja.com',
      senha: '123',
      perfil: 'FUNCIONARIO'
    });
    expect(resposta).toMatchObject({
      ok: false,
      erro: { campos: { senha: 'A senha precisa ter pelo menos 8 caracteres.' } }
    });
  });

  it('listar repassa o filtro já validado', async () => {
    const { registro, usuarios } = montar();
    await registro.atender('usuarios:listar', evento, { perfil: 'ADMIN', busca: ' ana ' });
    expect(usuarios.listar).toHaveBeenCalledWith({ perfil: 'ADMIN', busca: 'ana' });
  });

  it('regra de negócio do service chega na tela com a mensagem', async () => {
    const { registro, usuarios } = montar();
    usuarios.excluir.mockRejectedValueOnce(
      new RegraNegocioError('Você não pode excluir o seu próprio usuário.')
    );
    expect(await registro.atender('usuarios:excluir', evento, { id: 1 })).toEqual({
      ok: false,
      erro: { codigo: 'REGRA_NEGOCIO', mensagem: 'Você não pode excluir o seu próprio usuário.' }
    });
  });
});
