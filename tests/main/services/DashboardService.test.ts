import { describe, expect, it, vi } from 'vitest';
import type { NumerosDashboard } from '../../../src/main/repositories/DashboardRepository';
import { DashboardService, type RepoDashboard } from '../../../src/main/services/DashboardService';

const numeros: NumerosDashboard = {
  reservasAtivas: 3,
  reservasAtrasadas: 1,
  equipamentosEmManutencao: 2,
  multasEmAberto: 2,
  valorMultasEmAberto: 30.000000000000004,
  faturamentoNoPeriodo: 1250.1
};

function montar(hoje = '2026-11-17') {
  const repo = {
    numeros: vi.fn(async () => numeros),
    proximasDevolucoes: vi.fn(async () => [
      { reservaId: 4, cliente: 'Ana Souza', dataPrevista: '2026-11-15', diasAtraso: 2 }
    ])
  } satisfies RepoDashboard;
  return { repo, service: new DashboardService(repo, () => hoje) };
}

describe('DashboardService.resumo', () => {
  it('monta o resumo com os números e a lista de próximas devoluções', async () => {
    const { service } = montar();
    expect(await service.resumo()).toEqual({
      reservasAtivas: 3,
      reservasAtrasadas: 1,
      equipamentosEmManutencao: 2,
      multasEmAberto: 2,
      valorMultasEmAberto: 30,
      faturamentoDoMes: 1250.1,
      proximasDevolucoes: [
        { reservaId: 4, cliente: 'Ana Souza', dataPrevista: '2026-11-15', diasAtraso: 2 }
      ]
    });
  });

  it('usa o mês de hoje para o faturamento e a data de hoje para os atrasos', async () => {
    const { repo, service } = montar('2026-11-17');
    await service.resumo();
    expect(repo.numeros).toHaveBeenCalledWith('2026-11-17', '2026-11-01', '2026-12-01');
    expect(repo.proximasDevolucoes).toHaveBeenCalledWith(
      '2026-11-17',
      DashboardService.LIMITE_PROXIMAS
    );
  });
});

describe('DashboardService.mesDe', () => {
  it('início do mês e início do mês seguinte', () => {
    expect(DashboardService.mesDe('2026-02-28')).toEqual({
      inicio: '2026-02-01',
      inicioProximo: '2026-03-01'
    });
  });

  it('dezembro vira janeiro do ano seguinte', () => {
    expect(DashboardService.mesDe('2026-12-31')).toEqual({
      inicio: '2026-12-01',
      inicioProximo: '2027-01-01'
    });
  });
});
