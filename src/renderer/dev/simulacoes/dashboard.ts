import type { DashboardResumoDTO } from '@shared/dto/dashboard.dto';
import type { Simulacao } from '../apiSimulada';

/** Resumo fixo do painel (só em desenvolvimento), parecido com o seed do banco. */
export function simularDashboard(): Simulacao {
  return {
    resumo: (): DashboardResumoDTO => ({
      reservasAtivas: 3,
      reservasAtrasadas: 1,
      equipamentosEmManutencao: 1,
      multasEmAberto: 2,
      valorMultasEmAberto: 45.5,
      faturamentoDoMes: 1250,
      proximasDevolucoes: [
        { reservaId: 3, cliente: 'Carlos Pereira', dataPrevista: '2026-11-14', diasAtraso: 3 },
        { reservaId: 5, cliente: 'Ana Souza', dataPrevista: '2026-11-18', diasAtraso: 0 },
        { reservaId: 6, cliente: 'Beatriz Lima', dataPrevista: '2026-11-21', diasAtraso: 0 }
      ]
    })
  };
}
