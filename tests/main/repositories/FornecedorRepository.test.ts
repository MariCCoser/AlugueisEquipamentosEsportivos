import { describe, expect, it } from 'vitest';
import { FornecedorRepository } from '../../../src/main/repositories/FornecedorRepository';
import { ExecutorFalso } from './ExecutorFalso';

function montar() {
  const db = new ExecutorFalso();
  return { db, repo: new FornecedorRepository(db) };
}

describe('FornecedorRepository.listarFiltrado', () => {
  it('sem filtro lista tudo em ordem de razão social', async () => {
    const { db, repo } = montar();
    await repo.listarFiltrado();
    expect(db.ultima.sql).not.toContain('WHERE');
    expect(db.ultima.sql).toContain('ORDER BY razao_social');
  });

  it('filtra por tipo com parâmetro', async () => {
    const { db, repo } = montar();
    await repo.listarFiltrado({ tipo: 'MANUTENCAO' });
    expect(db.ultima.sql).toContain('WHERE tipo = ?');
    expect(db.ultima.params).toEqual(['MANUTENCAO']);
  });

  it('busca por texto escapando os curingas do LIKE', async () => {
    const { db, repo } = montar();
    await repo.listarFiltrado({ busca: '100%_bike' });
    expect(db.ultima.sql).toContain('razao_social LIKE ?');
    expect(db.ultima.params).toEqual(['%100\\%\\_bike%', '100%']);
  });

  it('busca com números também procura pelo começo do CNPJ', async () => {
    const { db, repo } = montar();
    await repo.listarFiltrado({ tipo: 'COMPRA', busca: '11.222' });
    expect(db.ultima.sql).toContain('tipo = ? AND (razao_social LIKE ? OR cnpj LIKE ?)');
    expect(db.ultima.params).toEqual(['COMPRA', '%11.222%', '11222%']);
  });
});

describe('FornecedorRepository.contarVinculos', () => {
  it('conta equipamentos e manutenções numa consulta só', async () => {
    const { db, repo } = montar();
    db.responderConsulta({ equipamentos: '2', manutencoes: 1 });
    expect(await repo.contarVinculos(7)).toEqual({ equipamentos: 2, manutencoes: 1 });
    expect(db.chamadas).toHaveLength(1);
    expect(db.ultima.params).toEqual([7, 7]);
  });
});
