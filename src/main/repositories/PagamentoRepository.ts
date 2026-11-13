import type { TipoPagamento } from '@shared/models/enums';
import type { NovoPagamento, Pagamento } from '@shared/models/entidades';
import type { ParametroSql } from '../database/Database';
import { BaseRepository, type CamposGravaveis } from './BaseRepository';

/** Tabela `pagamentos` (aluguel, caução ou multa de uma reserva). */
export class PagamentoRepository extends BaseRepository<Pagamento, NovoPagamento> {
  protected readonly tabela = 'pagamentos';
  protected readonly campos: CamposGravaveis<NovoPagamento> = {
    reservaId: true,
    multaId: true,
    tipo: true,
    forma: true,
    valor: true,
    data: true
  };

  listarPorReserva(reservaId: number): Promise<Pagamento[]> {
    return this.selecionar('reserva_id = ?', [reservaId], 'ORDER BY data, id');
  }

  /** Soma do que foi pago na reserva; com `tipo`, só daquele tipo. */
  async somarPorReserva(reservaId: number, tipo?: TipoPagamento): Promise<number> {
    const params: ParametroSql[] = [reservaId];
    let sql = 'SELECT COALESCE(SUM(valor), 0) AS total FROM pagamentos WHERE reserva_id = ?';
    if (tipo) {
      sql += ' AND tipo = ?';
      params.push(tipo);
    }
    const [linha] = await this.db.consultar<{ total: number | string }>(sql, params);
    return Number(linha?.total ?? 0);
  }

  async somarPorMulta(multaId: number): Promise<number> {
    const [linha] = await this.db.consultar<{ total: number | string }>(
      'SELECT COALESCE(SUM(valor), 0) AS total FROM pagamentos WHERE multa_id = ?',
      [multaId]
    );
    return Number(linha?.total ?? 0);
  }

  /** Faturamento entre duas datas (inclusive), para o dashboard. */
  async somarNoPeriodo(inicio: string, fim: string): Promise<number> {
    const [linha] = await this.db.consultar<{ total: number | string }>(
      'SELECT COALESCE(SUM(valor), 0) AS total FROM pagamentos WHERE DATE(data) BETWEEN ? AND ?',
      [inicio, fim]
    );
    return Number(linha?.total ?? 0);
  }
}
