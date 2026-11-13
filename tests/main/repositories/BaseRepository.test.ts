import { describe, expect, it } from 'vitest';
import type { NovaCategoria } from '../../../src/shared/models/entidades';
import {
  POR_PAGINA_MAXIMO,
  RepositorioError,
  escaparLike,
  paraCamel,
  paraSnake
} from '../../../src/main/repositories/BaseRepository';
import { CategoriaRepository } from '../../../src/main/repositories/CategoriaRepository';
import { ExecutorFalso } from './ExecutorFalso';

/** A BaseRepository é abstrata; testamos pelo CategoriaRepository, que não muda nada do CRUD. */
const linhaCategoria = {
  id: 7,
  nome: 'Patins',
  descricao: null,
  sensivel_clima: 1,
  created_at: '2026-11-13 10:00:00',
  updated_at: '2026-11-13 10:00:00'
};

function montar() {
  const db = new ExecutorFalso();
  return { db, repo: new CategoriaRepository(db) };
}

describe('funções auxiliares', () => {
  it('converte snake_case <-> camelCase', () => {
    expect(paraSnake('dataDevolucaoPrevista')).toBe('data_devolucao_prevista');
    expect(paraCamel('data_devolucao_prevista')).toBe('dataDevolucaoPrevista');
    expect(paraCamel('id')).toBe('id');
  });

  it('escaparLike neutraliza os curingas do LIKE', () => {
    expect(escaparLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});

describe('BaseRepository (via CategoriaRepository)', () => {
  it('criar faz INSERT só com os campos informados e devolve a entidade convertida', async () => {
    const { db, repo } = montar();
    db.responderEscrita({ idInserido: 7 }).responderConsulta(linhaCategoria);

    const categoria = await repo.criar({ nome: 'Patins', sensivelClima: true });

    expect(db.chamadas[0]).toEqual({
      tipo: 'executar',
      sql: 'INSERT INTO categorias (nome, sensivel_clima) VALUES (?, ?)',
      params: ['Patins', true]
    });
    expect(db.chamadas[1]?.params).toEqual([7]);
    expect(categoria).toEqual({
      id: 7,
      nome: 'Patins',
      descricao: null,
      sensivelClima: true,
      createdAt: '2026-11-13 10:00:00',
      updatedAt: '2026-11-13 10:00:00'
    });
  });

  it('ignora chaves desconhecidas (não deixa nome de coluna vir de fora)', async () => {
    const { db, repo } = montar();
    db.responderConsulta(linhaCategoria);
    const malicioso = { nome: 'X', 'id = 1; DROP TABLE categorias; --': 1, id: 99 };

    await repo.criar(malicioso as unknown as NovaCategoria);

    expect(db.chamadas[0]?.sql).toBe('INSERT INTO categorias (nome) VALUES (?)');
    expect(db.chamadas[0]?.params).toEqual(['X']);
  });

  it('criar sem nenhum campo lança erro sem tocar no banco', async () => {
    const { db, repo } = montar();
    await expect(repo.criar({} as NovaCategoria)).rejects.toBeInstanceOf(RepositorioError);
    expect(db.chamadas).toHaveLength(0);
  });

  it('buscarPorId devolve null quando não acha', async () => {
    const { db, repo } = montar();
    expect(await repo.buscarPorId(123)).toBeNull();
    expect(db.ultima).toEqual({
      tipo: 'consultar',
      sql: 'SELECT * FROM categorias WHERE id = ? LIMIT 1',
      params: [123]
    });
  });

  it('atualizar muda só os campos definidos; null grava NULL', async () => {
    const { db, repo } = montar();
    db.responderConsulta(linhaCategoria);

    await repo.atualizar(7, { descricao: null, nome: undefined, sensivelClima: false });

    expect(db.chamadas[0]).toEqual({
      tipo: 'executar',
      sql: 'UPDATE categorias SET descricao = ?, sensivel_clima = ? WHERE id = ?',
      params: [null, false, 7]
    });
  });

  it('atualizar sem campos só busca o registro', async () => {
    const { db, repo } = montar();
    await repo.atualizar(7, {});
    expect(db.chamadas).toHaveLength(1);
    expect(db.ultima.tipo).toBe('consultar');
  });

  it('excluir devolve se alguma linha foi apagada', async () => {
    const { db, repo } = montar();
    db.responderEscrita({ linhasAfetadas: 1 }).responderEscrita({ linhasAfetadas: 0 });
    expect(await repo.excluir(1)).toBe(true);
    expect(await repo.excluir(2)).toBe(false);
    expect(db.ultima.sql).toBe('DELETE FROM categorias WHERE id = ?');
  });

  it('listar usa ORDER BY e LIMIT/OFFSET parametrizados', async () => {
    const { db, repo } = montar();
    await repo.listar({ pagina: 3, porPagina: 10, ordenarPor: 'nome', direcao: 'DESC' });
    expect(db.ultima).toEqual({
      tipo: 'consultar',
      sql: 'SELECT * FROM categorias ORDER BY nome DESC, id DESC LIMIT ? OFFSET ?',
      params: [10, 20]
    });
  });

  it('listar corrige página/porPagina fora do limite', async () => {
    const { db, repo } = montar();
    await repo.listar({ pagina: -5, porPagina: 5000 });
    expect(db.ultima.params).toEqual([POR_PAGINA_MAXIMO, 0]);
    await repo.listar({ porPagina: 0 });
    expect(db.ultima.params).toEqual([20, 0]);
  });

  it('listar recusa ordenar por campo desconhecido', async () => {
    const { db, repo } = montar();
    await expect(
      repo.listar({ ordenarPor: 'nome; DROP TABLE x' as 'nome' })
    ).rejects.toBeInstanceOf(RepositorioError);
    expect(db.chamadas).toHaveLength(0);
  });

  it('listarPaginado devolve itens, total e a página', async () => {
    const { db, repo } = montar();
    db.responderConsulta(linhaCategoria).responderConsulta({ total: '41' });
    const resultado = await repo.listarPaginado({ pagina: 2, porPagina: 20 });
    expect(resultado.total).toBe(41);
    expect(resultado.pagina).toBe(2);
    expect(resultado.porPagina).toBe(20);
    expect(resultado.itens[0]?.sensivelClima).toBe(true);
  });
});
