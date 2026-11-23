import { describe, expect, it } from 'vitest';
import { UsuarioRepository } from '../../../src/main/repositories/UsuarioRepository';
import { ExecutorFalso } from './ExecutorFalso';

function montar() {
  const db = new ExecutorFalso();
  return { db, repo: new UsuarioRepository(db) };
}

describe('UsuarioRepository.listarFiltrado', () => {
  it('sem filtro lista todos em ordem de nome', async () => {
    const { db, repo } = montar();
    await repo.listarFiltrado();
    expect(db.ultima.sql).not.toContain('WHERE');
    expect(db.ultima.sql).toContain('ORDER BY nome, id');
  });

  it('filtra por perfil e ativo com parâmetros', async () => {
    const { db, repo } = montar();
    await repo.listarFiltrado({ perfil: 'FUNCIONARIO', ativo: false });
    expect(db.ultima.sql).toContain('WHERE perfil = ? AND ativo = ?');
    expect(db.ultima.params).toEqual(['FUNCIONARIO', 0]);
  });

  it('busca no nome ou no e-mail escapando os curingas do LIKE', async () => {
    const { db, repo } = montar();
    await repo.listarFiltrado({ busca: ' ana_% ' });
    expect(db.ultima.sql).toContain('(nome LIKE ? OR email LIKE ?)');
    expect(db.ultima.params).toEqual(['%ana\\_\\%%', '%ana\\_\\%%']);
  });

  it('converte o ativo do banco (0/1) em booleano', async () => {
    const { db, repo } = montar();
    db.responderConsulta({ id: 1, nome: 'Ana', ativo: 1 }, { id: 2, nome: 'Rita', ativo: 0 });
    const lista = await repo.listarFiltrado();
    expect(lista.map((u) => u.ativo)).toEqual([true, false]);
  });
});

describe('UsuarioRepository.contarReservas', () => {
  it('conta as reservas registradas pelo usuário', async () => {
    const { db, repo } = montar();
    db.responderConsulta({ total: '3' });
    expect(await repo.contarReservas(2)).toBe(3);
    expect(db.ultima.sql).toContain('FROM reservas WHERE usuario_id = ?');
    expect(db.ultima.params).toEqual([2]);
  });

  it('sem resposta devolve 0', async () => {
    const { repo } = montar();
    expect(await repo.contarReservas(9)).toBe(0);
  });
});
