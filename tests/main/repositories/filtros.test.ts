import { describe, expect, it } from 'vitest';
import { criarRepositorios } from '../../../src/main/repositories';
import { ExecutorFalso } from './ExecutorFalso';

/** Filtros acrescentados pela Pessoa 2 na etapa 4 (multas, pagamentos, manutenções). */
function montar() {
  const db = new ExecutorFalso();
  return { db, r: criarRepositorios(db) };
}

describe('MultaRepository', () => {
  it('filtrar junta com reservas para filtrar por cliente', async () => {
    const { db, r } = montar();
    db.responderConsulta({ id: 1, reserva_id: 4, quitada: 0 });
    const [multa] = await r.multas.filtrar({ quitada: false, clienteId: 3 });
    expect(db.ultima.sql).toBe(
      'SELECT m.* FROM multas m JOIN reservas r ON r.id = m.reserva_id ' +
        'WHERE m.quitada = ? AND r.cliente_id = ? ORDER BY m.created_at DESC, m.id DESC'
    );
    expect(db.ultima.params).toEqual([0, 3]);
    expect(multa).toMatchObject({ reservaId: 4, quitada: false });
  });

  it('sem filtro e reabrir', async () => {
    const { db, r } = montar();
    await r.multas.filtrar();
    expect(db.ultima.sql).not.toContain('WHERE');
    await r.multas.reabrir(5);
    expect(db.ultima.sql).toBe(
      'UPDATE multas SET quitada = 0, data_quitacao = NULL WHERE id = ? AND quitada = 1'
    );
  });
});

describe('PagamentoRepository', () => {
  it('filtrar por tipo e período (datas inclusivas)', async () => {
    const { db, r } = montar();
    await r.pagamentos.filtrar({ tipo: 'MULTA', dataInicio: '2026-11-01', dataFim: '2026-11-30' });
    expect(db.ultima.sql).toBe(
      'SELECT * FROM pagamentos WHERE tipo = ? AND DATE(data) >= ? AND DATE(data) <= ? ' +
        'ORDER BY data DESC, id DESC'
    );
    expect(db.ultima.params).toEqual(['MULTA', '2026-11-01', '2026-11-30']);
  });

  it('listarPorMulta', async () => {
    const { db, r } = montar();
    await r.pagamentos.listarPorMulta(9);
    expect(db.ultima.sql).toBe('SELECT * FROM pagamentos WHERE multa_id = ? ORDER BY data, id');
  });
});

describe('ManutencaoRepository', () => {
  it('filtrar abertas/fechadas, tipo e prestador', async () => {
    const { db, r } = montar();
    await r.manutencoes.filtrar({ abertas: true, tipo: 'CORRETIVA', fornecedorId: 2 });
    expect(db.ultima.sql).toBe(
      'SELECT * FROM manutencoes WHERE data_retorno IS NULL AND tipo = ? AND fornecedor_id = ? ' +
        'ORDER BY data_envio DESC, id DESC'
    );
    expect(db.ultima.params).toEqual(['CORRETIVA', 2]);
    await r.manutencoes.filtrar({ abertas: false });
    expect(db.ultima.sql).toContain('data_retorno IS NOT NULL');
  });
});
