import type { DashboardResumoDTO } from '@shared/dto/dashboard.dto';
import type { DataISO } from '@shared/dto/resposta';
import type { DashboardRepository } from '../repositories/DashboardRepository';

export type RepoDashboard = Pick<DashboardRepository, 'numeros' | 'proximasDevolucoes'>;

/**
 * Monta o resumo do painel (canal dashboard:resumo).
 * `hoje` é injetado (em vez de usar new Date() aqui dentro) para os testes
 * poderem fixar a data, igual aos services da Pessoa 2.
 */
export class DashboardService {
  /** Quantas reservas aparecem na lista "Próximas devoluções". */
  static readonly LIMITE_PROXIMAS = 8;

  constructor(
    private readonly repo: RepoDashboard,
    private readonly hoje: () => DataISO
  ) {}

  async resumo(): Promise<DashboardResumoDTO> {
    const hoje = this.hoje();
    const { inicio, inicioProximo } = DashboardService.mesDe(hoje);

    const [numeros, proximasDevolucoes] = await Promise.all([
      this.repo.numeros(hoje, inicio, inicioProximo),
      this.repo.proximasDevolucoes(hoje, DashboardService.LIMITE_PROXIMAS)
    ]);

    return {
      reservasAtivas: numeros.reservasAtivas,
      reservasAtrasadas: numeros.reservasAtrasadas,
      equipamentosEmManutencao: numeros.equipamentosEmManutencao,
      multasEmAberto: numeros.multasEmAberto,
      valorMultasEmAberto: DashboardService.centavosExatos(numeros.valorMultasEmAberto),
      faturamentoDoMes: DashboardService.centavosExatos(numeros.faturamentoNoPeriodo),
      proximasDevolucoes
    };
  }

  /**
   * '2026-11-17' → { inicio: '2026-11-01', inicioProximo: '2026-12-01' }.
   * O fim é exclusivo ("antes do dia 1º do mês seguinte"), assim não importa
   * quantos dias o mês tem nem a hora do pagamento no último dia.
   */
  static mesDe(hoje: DataISO): { inicio: DataISO; inicioProximo: DataISO } {
    const [ano, mes] = hoje.split('-').map(Number);
    const proximoAno = mes === 12 ? ano + 1 : ano;
    const proximoMes = mes === 12 ? 1 : mes + 1;
    const doisDigitos = (n: number): string => String(n).padStart(2, '0');
    return {
      inicio: `${ano}-${doisDigitos(mes)}-01`,
      inicioProximo: `${proximoAno}-${doisDigitos(proximoMes)}-01`
    };
  }

  /** Corrige o ruído de ponto flutuante das somas de DECIMAL (ex.: 30.000000000004). */
  private static centavosExatos(reais: number): number {
    return Math.round(reais * 100) / 100;
  }
}
