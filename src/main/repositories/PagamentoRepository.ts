import type { TipoPagamento } from '@shared/models/enums';
import type { NovoPagamento, Pagamento } from '@shared/models/entidades';
import type { ParametroSql } from '../database/Database';
import { BaseRepository, type CamposGravaveis } from './BaseRepository';

export interface FiltroPagamentos {
  tipo?: TipoPagamento;
  /** Datas 'AAAA-MM-DD', inclusive. */
  dataInicio?: string;
  dataFim?: string;
}

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

  /** Filtros da tela de pagamentos (tipo e período). Mais recentes primeiro. */
  filtrar(filtro: FiltroPagamentos = {}): Promise<Pagamento[]> {
    const condicoes: string[] = [];
    const params: ParametroSql[] = [];
    if (filtro.tipo) {
      condicoes.push('tipo = ?');
      params.push(filtro.tipo);
    }
    if (filtro.dataInicio) {
      condicoes.push('DATE(data) >= ?');
      params.push(filtro.dataInicio);
    }
    if (filtro.dataFim) {
      condicoes.push('DATE(data) <= ?');
      params.push(filtro.dataFim);
    }
    return this.selecionar(condicoes.join(' AND '), params, 'ORDER BY data DESC, id DESC');
  }

  listarPorMulta(multaId: number): Promise<Pagamento[]> {
    return this.selecionar('multa_id = ?', [multaId], 'ORDER BY data, id');
  }

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
