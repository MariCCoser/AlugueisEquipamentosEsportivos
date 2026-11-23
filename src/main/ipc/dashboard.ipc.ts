import { IPC } from '@shared/ipc-channels';
import { sucesso } from '@shared/dto/resposta';
import type { DashboardResumoDTO } from '@shared/dto/dashboard.dto';
import type { DashboardService } from '../services/DashboardService';
import type { RegistroIpc } from './registrarHandlers';

/** Canal `dashboard:resumo` (qualquer usuário logado, ver permissoes.ts). Não recebe dados. */
export function registrarDashboardIpc(registro: RegistroIpc, dashboard: DashboardService): void {
  registro.registrar<DashboardResumoDTO>(IPC.dashboard.resumo, async () =>
    sucesso(await dashboard.resumo())
  );
}
