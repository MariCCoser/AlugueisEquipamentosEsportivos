import type { DataISO } from '@shared/dto/resposta';
import type { Executor } from '../database/Database';

/** Números do painel, já somados pelo banco. */
export interface NumerosDashboard {
  reservasAtivas: number;
  reservasAtrasadas: number;
  equipamentosEmManutencao: number;
  multasEmAberto: number;
  valorMultasEmAberto: number;
  faturamentoNoPeriodo: number;
}

export interface LinhaProximaDevolucao {
  reservaId: number;
  cliente: string;
  dataPrevista: DataISO;
  diasAtraso: number;
}

/**
 * Consultas só de leitura do painel (Pessoa 4).
 * Não estende o BaseRepository porque não é o CRUD de uma tabela: junta
 * reservas, manutenções, multas e pagamentos. Todos os valores vão em parâmetros (`?`).
 */
export class DashboardRepository {
  constructor(private readonly db: Executor) {}

  /**
   * Todos os números numa consulta só (uma subconsulta por cartão), para o painel
   * abrir com uma ida ao banco.
   * @param hoje data de referência para "atrasada"
   * @param inicioPeriodo primeiro dia do período do faturamento (inclusive)
   * @param fimPeriodo dia seguinte ao último dia do período (exclusive)
   */
  async numeros(
    hoje: DataISO,
    inicioPeriodo: DataISO,
    fimPeriodo: DataISO
  ): Promise<NumerosDashboard> {
    const [linha] = await this.db.consultar<Record<keyof NumerosDashboard, number | string | null>>(
      `SELECT
         (SELECT COUNT(*) FROM reservas WHERE status = 'ATIVA') AS reservasAtivas,
         (SELECT COUNT(*) FROM reservas
           WHERE status = 'ATIVA' AND data_devolucao_prevista < ?) AS reservasAtrasadas,
         (SELECT COUNT(DISTINCT equipamento_id) FROM manutencoes
           WHERE data_retorno IS NULL) AS equipamentosEmManutencao,
         (SELECT COUNT(*) FROM multas WHERE quitada = 0) AS multasEmAberto,
         (SELECT COALESCE(SUM(m.valor - COALESCE(
             (SELECT SUM(p.valor) FROM pagamentos p WHERE p.multa_id = m.id), 0)), 0)
            FROM multas m WHERE m.quitada = 0) AS valorMultasEmAberto,
         (SELECT COALESCE(SUM(valor), 0) FROM pagamentos
           WHERE data >= ? AND data < ?) AS faturamentoNoPeriodo`,
      [hoje, inicioPeriodo, fimPeriodo]
    );
    const numero = (valor: number | string | null | undefined): number => Number(valor ?? 0);
    return {
      reservasAtivas: numero(linha?.reservasAtivas),
      reservasAtrasadas: numero(linha?.reservasAtrasadas),
      equipamentosEmManutencao: numero(linha?.equipamentosEmManutencao),
      multasEmAberto: numero(linha?.multasEmAberto),
      valorMultasEmAberto: numero(linha?.valorMultasEmAberto),
      faturamentoNoPeriodo: numero(linha?.faturamentoNoPeriodo)
    };
  }

  /** Reservas ATIVAS com devolução mais próxima (as atrasadas aparecem primeiro). */
  async proximasDevolucoes(hoje: DataISO, limite: number): Promise<LinhaProximaDevolucao[]> {
    const linhas = await this.db.consultar<{
      reservaId: number;
      cliente: string;
      dataPrevista: string; // DATE chega como 'YYYY-MM-DD' (dateStrings: true no Database)
      diasAtraso: number | string;
    }>(
      `SELECT r.id AS reservaId,
              c.nome AS cliente,
              r.data_devolucao_prevista AS dataPrevista,
              GREATEST(DATEDIFF(?, r.data_devolucao_prevista), 0) AS diasAtraso
         FROM reservas r
         JOIN clientes c ON c.id = r.cliente_id
        WHERE r.status = 'ATIVA'
        ORDER BY r.data_devolucao_prevista, r.id
        LIMIT ?`,
      [hoje, limite]
    );
    return linhas.map((l) => ({
      reservaId: Number(l.reservaId),
      cliente: l.cliente,
      dataPrevista: l.dataPrevista,
      diasAtraso: Number(l.diasAtraso)
    }));
  }
}
