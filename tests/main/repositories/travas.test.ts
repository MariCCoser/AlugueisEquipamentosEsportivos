import { describe, expect, it } from 'vitest';
import { criarRepositorios } from '../../../src/main/repositories';
import { ExecutorFalso } from './ExecutorFalso';

/** Métodos acrescentados pela Pessoa 2 na etapa 3 (reservas). */
function montar() {
  const db = new ExecutorFalso();
  return { db, r: criarRepositorios(db) };
}

describe('travas (SELECT ... FOR UPDATE)', () => {
  it('equipamentos: trava em ordem de id, sem repetir', async () => {
    const { db, r } = montar();
    await r.equipamentos.travarPorIds([5, 2, 5]);
    expect(db.ultima.sql).toBe(
      'SELECT * FROM equipamentos WHERE id IN (?, ?) ORDER BY id FOR UPDATE'
    );
    expect(db.ultima.params).toEqual([5, 2]);
  });

  it('equipamentos: lista vazia nem consulta o banco', async () => {
    const { db, r } = montar();
    expect(await r.equipamentos.travarPorIds([])).toEqual([]);
    expect(db.chamadas).toHaveLength(0);
  });

  it('reserva e itens da reserva', async () => {
    const { db, r } = montar();
    db.responderConsulta({ id: 7, status: 'PENDENTE' });
    expect(await r.reservas.travar(7)).toMatchObject({ id: 7 });
    expect(db.ultima.sql).toBe('SELECT * FROM reservas WHERE id = ? FOR UPDATE');

    await r.itensReserva.travarDaReserva(7);
    expect(db.ultima.sql).toBe(
      'SELECT * FROM itens_reserva WHERE reserva_id = ? ORDER BY id FOR UPDATE'
    );
    expect(await r.reservas.travar(99)).toBeNull();
  });
});

describe('ReservaRepository.filtrar', () => {
  it('combina filtros só com parâmetros e pagina no banco', async () => {
    const { db, r } = montar();
    db.responderConsulta({ id: 1, cliente_id: 3 }).responderConsulta({ total: 41 });
    const pagina = await r.reservas.filtrar(
      { status: 'ATIVA', clienteId: 3, dataInicio: '2026-11-01', dataFim: '2026-11-30' },
      { pagina: 3, porPagina: 20 }
    );
    const [lista, contagem] = db.chamadas;
    expect(lista?.sql).toBe(
      'SELECT * FROM reservas WHERE status = ? AND cliente_id = ? AND data_retirada <= ? ' +
        'AND data_devolucao_prevista >= ? ORDER BY data_retirada DESC, id DESC LIMIT ? OFFSET ?'
    );
    expect(lista?.params).toEqual(['ATIVA', 3, '2026-11-30', '2026-11-01', 20, 40]);
    expect(contagem?.params).toEqual(['ATIVA', 3, '2026-11-30', '2026-11-01']);
    expect(pagina).toMatchObject({ total: 41, pagina: 3, porPagina: 20 });
    expect(pagina.itens[0]).toMatchObject({ clienteId: 3 });
  });

  it('sem filtros e com paginação fora dos limites', async () => {
    const { db, r } = montar();
    const pagina = await r.reservas.filtrar({}, { pagina: 0, porPagina: 5000 });
    expect(db.chamadas[0]?.sql).toBe(
      'SELECT * FROM reservas ORDER BY data_retirada DESC, id DESC LIMIT ? OFFSET ?'
    );
    expect(pagina).toMatchObject({ pagina: 1, porPagina: 100 });
  });
});
