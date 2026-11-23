import { beforeEach, describe, expect, it } from 'vitest';
import {
  NaoAutorizadoError,
  NaoEncontradoError,
  RegraNegocioError,
  ValidacaoError
} from '../../../src/main/errors/ErroApp';
import { HashSenha } from '../../../src/main/security/HashSenha';
import { Sessao } from '../../../src/main/security/Sessao';
import { UsuarioService } from '../../../src/main/services/UsuarioService';
import { erroMysql, umUsuario } from './dadosTeste';
import { criarRepoUsuarios } from './usuariosFalsos';

const hashSenha = new HashSenha(4);

function montar() {
  const r = criarRepoUsuarios([
    umUsuario({ id: 1 }),
    umUsuario({
      id: 2,
      nome: 'Funcionária Exemplo',
      email: 'funcionario@aluguel.local',
      perfil: 'FUNCIONARIO'
    }),
    umUsuario({ id: 3, nome: 'Pedro Alves', email: 'pedro@aluguel.local', perfil: 'FUNCIONARIO' })
  ]);
  r.reservas.set(2, 4); // a funcionária já registrou reservas
  const sessao = new Sessao();
  sessao.iniciar({ id: 1, nome: 'Administrador', email: 'admin@aluguel.local', perfil: 'ADMIN' });
  return { ...r, sessao, service: new UsuarioService(r.repo, hashSenha, sessao) };
}

/** Pega o erro lançado por uma promise (para conferir o tipo e os campos). */
async function erroDe(promessa: Promise<unknown>): Promise<unknown> {
  return promessa.then(
    () => {
      throw new Error('era esperado um erro');
    },
    (erro: unknown) => erro
  );
}

describe('UsuarioService: listar e buscar', () => {
  it('nunca devolve senha nem hash para a tela', async () => {
    const { service } = montar();
    const lista = await service.listar();
    expect(lista).toHaveLength(3);
    for (const u of lista) {
      expect(u).not.toHaveProperty('senhaHash');
      expect(u).not.toHaveProperty('senha');
    }
    expect(await service.buscarPorId(3)).toMatchObject({ id: 3, nome: 'Pedro Alves', ativo: true });
  });

  it('repassa o filtro para o repositório', async () => {
    const { service, repo } = montar();
    const lista = await service.listar({ perfil: 'FUNCIONARIO', ativo: true });
    expect(repo.listarFiltrado).toHaveBeenCalledWith({ perfil: 'FUNCIONARIO', ativo: true });
    expect(lista.map((u) => u.id)).toEqual([2, 3]);
  });

  it('id que não existe dá NaoEncontrado', async () => {
    const { service } = montar();
    await expect(service.buscarPorId(99)).rejects.toBeInstanceOf(NaoEncontradoError);
  });
});

describe('UsuarioService.criar', () => {
  let m: ReturnType<typeof montar>;
  beforeEach(() => (m = montar()));

  it('grava o hash bcrypt da senha, nunca o texto', async () => {
    const criado = await m.service.criar({
      nome: 'Rita Gomes',
      email: 'rita@aluguel.local',
      senha: 'Senha@123',
      perfil: 'FUNCIONARIO'
    });
    expect(criado).toMatchObject({ nome: 'Rita Gomes', perfil: 'FUNCIONARIO', ativo: true });
    const gravado = m.itens().find((u) => u.id === criado.id)!;
    expect(gravado.senhaHash).not.toContain('Senha@123');
    expect(await hashSenha.conferir('Senha@123', gravado.senhaHash)).toBe(true);
  });

  it('e-mail repetido marca o campo email', async () => {
    const erro = await erroDe(
      m.service.criar({
        nome: 'Outro',
        email: 'pedro@aluguel.local',
        senha: 'Senha@123',
        perfil: 'FUNCIONARIO'
      })
    );
    expect(erro).toBeInstanceOf(ValidacaoError);
    expect((erro as ValidacaoError).campos).toEqual({
      email: 'Já existe um usuário com este e-mail.'
    });
  });

  it('se o UNIQUE do banco reclamar (corrida), a mensagem continua amigável', async () => {
    m.repo.criar.mockRejectedValueOnce(erroMysql('ER_DUP_ENTRY'));
    await expect(
      m.service.criar({
        nome: 'Novo',
        email: 'novo@aluguel.local',
        senha: 'Senha@123',
        perfil: 'FUNCIONARIO'
      })
    ).rejects.toThrow('Já existe um usuário com este e-mail.');
  });
});

describe('UsuarioService.atualizar', () => {
  let m: ReturnType<typeof montar>;
  beforeEach(() => (m = montar()));

  it('altera só os campos enviados', async () => {
    const atualizado = await m.service.atualizar({ id: 3, nome: 'Pedro A. Alves' });
    expect(atualizado).toMatchObject({ nome: 'Pedro A. Alves', email: 'pedro@aluguel.local' });
  });

  it('desativa e reativa outro usuário', async () => {
    expect((await m.service.atualizar({ id: 3, ativo: false })).ativo).toBe(false);
    expect((await m.service.atualizar({ id: 3, ativo: true })).ativo).toBe(true);
  });

  it('não deixa a pessoa desativar nem rebaixar a si mesma', async () => {
    await expect(m.service.atualizar({ id: 1, ativo: false })).rejects.toBeInstanceOf(
      RegraNegocioError
    );
    await expect(m.service.atualizar({ id: 1, perfil: 'FUNCIONARIO' })).rejects.toThrow(
      'Você não pode desativar nem rebaixar o seu próprio usuário.'
    );
    expect(m.itens().find((u) => u.id === 1)).toMatchObject({ ativo: true, perfil: 'ADMIN' });
  });

  it('mudar o próprio nome atualiza a sessão (menu lateral)', async () => {
    await m.service.atualizar({ id: 1, nome: 'Admin da Loja' });
    expect(m.sessao.usuarioAtual()?.nome).toBe('Admin da Loja');
  });

  it('nova senha vira hash; sem nova senha, o hash não muda', async () => {
    const antes = m.itens().find((u) => u.id === 3)!.senhaHash;
    await m.service.atualizar({ id: 3, nome: 'Pedro' });
    expect(m.itens().find((u) => u.id === 3)!.senhaHash).toBe(antes);

    await m.service.atualizar({ id: 3, novaSenha: 'Trocada@99' });
    const depois = m.itens().find((u) => u.id === 3)!.senhaHash;
    expect(await hashSenha.conferir('Trocada@99', depois)).toBe(true);
  });

  it('e-mail de outro usuário é recusado; o próprio e-mail é aceito', async () => {
    const erro = await erroDe(m.service.atualizar({ id: 3, email: 'admin@aluguel.local' }));
    expect((erro as ValidacaoError).campos).toHaveProperty('email');
    await expect(
      m.service.atualizar({ id: 3, email: 'pedro@aluguel.local' })
    ).resolves.toBeDefined();
  });

  it('id que não existe dá NaoEncontrado', async () => {
    await expect(m.service.atualizar({ id: 99, nome: 'X' })).rejects.toBeInstanceOf(
      NaoEncontradoError
    );
  });
});

describe('UsuarioService.excluir', () => {
  let m: ReturnType<typeof montar>;
  beforeEach(() => (m = montar()));

  it('exclui quem nunca registrou reservas', async () => {
    await m.service.excluir(3);
    expect(m.itens().map((u) => u.id)).toEqual([1, 2]);
  });

  it('não exclui quem já registrou reservas (sugere desativar)', async () => {
    await expect(m.service.excluir(2)).rejects.toThrow(/já registrou 4 reserva\(s\)\. Desative/);
    expect(m.repo.excluir).not.toHaveBeenCalled();
  });

  it('não deixa excluir o próprio usuário', async () => {
    await expect(m.service.excluir(1)).rejects.toThrow(
      'Você não pode excluir o seu próprio usuário.'
    );
  });

  it('se o banco recusar por FK, a mensagem continua amigável', async () => {
    m.repo.excluir.mockRejectedValueOnce(erroMysql('ER_ROW_IS_REFERENCED_2'));
    await expect(m.service.excluir(3)).rejects.toThrow(/Desative o acesso/);
  });

  it('sem ninguém logado é recusado', async () => {
    const r = criarRepoUsuarios();
    const service = new UsuarioService(r.repo, hashSenha, new Sessao());
    await expect(service.excluir(1)).rejects.toBeInstanceOf(NaoAutorizadoError);
  });
});
