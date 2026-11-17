import { describe, expect, it } from 'vitest';
import { CategoriaRepository } from '../../../src/main/repositories/CategoriaRepository';
import { ExecutorFalso } from './ExecutorFalso';

describe('CategoriaRepository.listarComUso', () => {
  it('conta os equipamentos de cada categoria numa consulta só', async () => {
    const db = new ExecutorFalso();
    db.responderConsulta(
      { id: 2, nome: 'Bolas', descricao: null, sensivel_clima: 0, qtd_equipamentos: '0' },
      { id: 1, nome: 'Caiaques', descricao: 'Lagoa', sensivel_clima: 1, qtd_equipamentos: 3 }
    );

    const lista = await new CategoriaRepository(db).listarComUso();

    expect(db.chamadas).toHaveLength(1);
    expect(db.ultima.sql).toContain('LEFT JOIN equipamentos');
    expect(db.ultima.sql).toContain('ORDER BY c.nome');
    expect(lista).toEqual([
      { id: 2, nome: 'Bolas', descricao: null, sensivelClima: false, qtdEquipamentos: 0 },
      { id: 1, nome: 'Caiaques', descricao: 'Lagoa', sensivelClima: true, qtdEquipamentos: 3 }
    ]);
  });
});
