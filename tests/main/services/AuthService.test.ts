import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NaoAutorizadoError, ValidacaoError } from '../../../src/main/errors/ErroApp';
import { HashSenha } from '../../../src/main/security/HashSenha';
import { LimiteTentativas } from '../../../src/main/security/LimiteTentativas';
import { Sessao } from '../../../src/main/security/Sessao';
import { AuthService, MSG_LOGIN_INVALIDO } from '../../../src/main/services/AuthService';
import { umUsuario } from './dadosTeste';
import { criarRepoUsuarios } from './usuariosFalsos';

const hashSenha = new HashSenha(4); // custo baixo só para o teste ser rápido
let hashAdmin: string;
let hashFunc: string;

beforeAll(async () => {
  hashAdmin = await hashSenha.gerar('Admin@2026');
  hashFunc = await hashSenha.gerar('Func@2026');
});

function montar() {
  const r = criarRepoUsuarios([
    umUsuario({ id: 1, senhaHash: hashAdmin }),
    umUsuario({
      id: 2,
      nome: 'Funcionária Exemplo',
      email: 'funcionario@aluguel.local',
      perfil: 'FUNCIONARIO',
      senhaHash: hashFunc
    }),
    umUsuario({
      id: 3,
      nome: 'Rita Gomes',
      email: 'rita@aluguel.local',
      perfil: 'FUNCIONARIO',
      ativo: false,
      senhaHash: hashFunc
    })
  ]);
  const sessao = new Sessao();
  const limite = new LimiteTentativas(3, 60_000);
  const service = new AuthService(r.repo, sessao, hashSenha, limite);
  return { ...r, sessao, service };
}

describe('AuthService.login', () => {
  let m: ReturnType<typeof montar>;
  beforeEach(() => (m = montar()));

  it('com a senha certa inicia a sessão e devolve o usuário sem a senha', async () => {
    const logado = await m.service.login({ email: 'admin@aluguel.local', senha: 'Admin@2026' });
    expect(logado).toEqual({
      id: 1,
      nome: 'Administrador',
      email: 'admin@aluguel.local',
      perfil: 'ADMIN'
    });
    expect(logado).not.toHaveProperty('senhaHash');
    expect(m.sessao.perfilAtual()).toBe('ADMIN');
    expect(m.repo.registrarLogin).toHaveBeenCalledWith(1);
  });

  it('senha errada e e-mail inexistente dão a MESMA mensagem genérica', async () => {
    const senhaErrada = m.service.login({ email: 'admin@aluguel.local', senha: 'errada' });
    await expect(senhaErrada).rejects.toThrow(MSG_LOGIN_INVALIDO);
    const semConta = m.service.login({ email: 'ninguem@aluguel.local', senha: 'Admin@2026' });
    await expect(semConta).rejects.toThrow(MSG_LOGIN_INVALIDO);
    await expect(semConta).rejects.toBeInstanceOf(NaoAutorizadoError);
    expect(m.sessao.usuarioAtual()).toBeNull();
  });

  it('bloqueia o e-mail depois de várias senhas erradas, mesmo com a senha certa', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(
        m.service.login({ email: 'admin@aluguel.local', senha: 'errada' })
      ).rejects.toThrow(MSG_LOGIN_INVALIDO);
    }
    await expect(
      m.service.login({ email: 'admin@aluguel.local', senha: 'Admin@2026' })
    ).rejects.toThrow(/Muitas tentativas erradas/);
    expect(m.sessao.usuarioAtual()).toBeNull();
  });

  it('usuário desativado não entra, mesmo com a senha certa', async () => {
    await expect(
      m.service.login({ email: 'rita@aluguel.local', senha: 'Func@2026' })
    ).rejects.toThrow(/desativado/);
    expect(m.sessao.usuarioAtual()).toBeNull();
  });
});

describe('AuthService: sessão e logout', () => {
  it('sessaoAtual é null antes do login e depois do logout', async () => {
    const m = montar();
    expect(m.service.sessaoAtual()).toBeNull();
    await m.service.login({ email: 'funcionario@aluguel.local', senha: 'Func@2026' });
    expect(m.service.sessaoAtual()?.perfil).toBe('FUNCIONARIO');
    m.service.logout();
    expect(m.service.sessaoAtual()).toBeNull();
  });
});

describe('AuthService.alterarSenha', () => {
  let m: ReturnType<typeof montar>;
  beforeEach(async () => {
    m = montar();
    await m.service.login({ email: 'funcionario@aluguel.local', senha: 'Func@2026' });
  });

  it('com a senha atual certa grava o hash da nova (nunca o texto)', async () => {
    await m.service.alterarSenha({ senhaAtual: 'Func@2026', novaSenha: 'NovaSenha@1' });
    const gravado = m.itens().find((u) => u.id === 2)!;
    expect(gravado.senhaHash).not.toBe('NovaSenha@1');
    expect(await hashSenha.conferir('NovaSenha@1', gravado.senhaHash)).toBe(true);
  });

  it('senha atual errada marca o campo senhaAtual', async () => {
    const erro = await m.service
      .alterarSenha({ senhaAtual: 'errada', novaSenha: 'NovaSenha@1' })
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ValidacaoError);
    expect((erro as ValidacaoError).campos).toEqual({ senhaAtual: 'Senha atual incorreta.' });
  });

  it('a nova senha precisa ser diferente da atual', async () => {
    const erro = await m.service
      .alterarSenha({ senhaAtual: 'Func@2026', novaSenha: 'Func@2026' })
      .catch((e: unknown) => e);
    expect((erro as ValidacaoError).campos).toHaveProperty('novaSenha');
  });

  it('sem login é recusado', async () => {
    m.service.logout();
    await expect(
      m.service.alterarSenha({ senhaAtual: 'Func@2026', novaSenha: 'NovaSenha@1' })
    ).rejects.toBeInstanceOf(NaoAutorizadoError);
  });

  it('se o usuário foi desativado enquanto estava logado, a sessão é encerrada', async () => {
    m.itens().find((u) => u.id === 2)!.ativo = false;
    await expect(
      m.service.alterarSenha({ senhaAtual: 'Func@2026', novaSenha: 'NovaSenha@1' })
    ).rejects.toBeInstanceOf(NaoAutorizadoError);
    expect(m.sessao.usuarioAtual()).toBeNull();
  });
});
