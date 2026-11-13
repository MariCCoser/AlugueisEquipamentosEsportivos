import { describe, expect, it } from 'vitest';
import { Sessao } from '../../../src/main/security/Sessao';

const ana = { id: 1, nome: 'Ana', email: 'ana@aluguel.local', perfil: 'ADMIN' as const };

describe('Sessao', () => {
  it('começa sem ninguém logado', () => {
    const sessao = new Sessao();
    expect(sessao.usuarioAtual()).toBeNull();
    expect(sessao.perfilAtual()).toBeNull();
  });

  it('guarda quem fez login e esquece no logout', () => {
    const sessao = new Sessao();
    sessao.iniciar(ana);
    expect(sessao.perfilAtual()).toBe('ADMIN');
    expect(sessao.usuarioAtual()).toEqual(ana);
    sessao.encerrar();
    expect(sessao.usuarioAtual()).toBeNull();
  });

  it('quem recebe o usuário não consegue alterar a sessão por fora', () => {
    const sessao = new Sessao();
    const dados = { ...ana, perfil: 'FUNCIONARIO' as 'ADMIN' | 'FUNCIONARIO' };
    sessao.iniciar(dados);
    dados.perfil = 'ADMIN';
    const copia = sessao.usuarioAtual()!;
    copia.perfil = 'ADMIN';
    expect(sessao.perfilAtual()).toBe('FUNCIONARIO');
  });
});
