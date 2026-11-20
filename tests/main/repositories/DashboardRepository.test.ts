import { describe, expect, it } from 'vitest';
import { DashboardRepository } from '../../../src/main/repositories/DashboardRepository';
import { ExecutorFalso } from './ExecutorFalso';

function montar() {
  const db = new ExecutorFalso();
  return { db, repo: new DashboardRepository(db) };
}

describe('DashboardRepository.numeros', () => {
  it('busca todos os números numa consulta só, com as datas em parâmetros', async () => {
    const { db, repo } = montar();
    db.responderConsulta({
      reservasAtivas: 3,
      reservasAtrasadas: '1',
      equipamentosEmManutencao: 2,
      multasEmAberto: 1,
      valorMultasEmAberto: '45.50',
      faturamentoNoPeriodo: '1250.00'
    });

    const numeros = await repo.numeros('2026-11-17', '2026-11-01', '2026-12-01');

    expect(db.chamadas).toHaveLength(1);
    expect(db.ultima.params).toEqual(['2026-11-17', '2026-11-01', '2026-12-01']);
    expect(db.ultima.sql).toContain("status = 'ATIVA' AND data_devolucao_prevista < ?");
    expect(db.ultima.sql).toContain('data_retorno IS NULL');
    expect(db.ultima.sql).toContain('quitada = 0');
    expect(numeros).toEqual({
      reservasAtivas: 3,
      reservasAtrasadas: 1,
      equipamentosEmManutencao: 2,
      multasEmAberto: 1,
      valorMultasEmAberto: 45.5,
      faturamentoNoPeriodo: 1250
    });
  });

  it('banco vazio vira zeros', async () => {
    const { repo } = montar();
    const numeros = await repo.numeros('2026-11-17', '2026-11-01', '2026-12-01');
    expect(Object.values(numeros).every((n) => n === 0)).toBe(true);
  });
});

describe('DashboardRepository.proximasDevolucoes', () => {
  it('lista reservas ativas pela data prevista, com limite em parâmetro', async () => {
    const { db, repo } = montar();
    db.responderConsulta({
      reservaId: 4,
      cliente: 'Ana Souza',
      dataPrevista: '2026-11-15',
      diasAtraso: '2'
    });

    const lista = await repo.proximasDevolucoes('2026-11-17', 8);

    expect(db.ultima.sql).toContain("r.status = 'ATIVA'");
    expect(db.ultima.sql).toContain('ORDER BY r.data_devolucao_prevista');
    expect(db.ultima.params).toEqual(['2026-11-17', 8]);
    expect(lista).toEqual([
      { reservaId: 4, cliente: 'Ana Souza', dataPrevista: '2026-11-15', diasAtraso: 2 }
    ]);
  });
});
