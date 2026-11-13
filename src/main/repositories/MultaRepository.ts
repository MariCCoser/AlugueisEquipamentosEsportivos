import type { Multa, NovaMulta } from '@shared/models/entidades';
import type { ParametroSql } from '../database/Database';
import { BaseRepository, type CamposGravaveis, type Linha } from './BaseRepository';

export interface FiltroMultas {
  quitada?: boolean;
  /** Dono da reserva que gerou a multa. */
  clienteId?: number;
}

/** Tabela `multas`. No máximo uma multa por reserva (UNIQUE em reserva_id). */
export class MultaRepository extends BaseRepository<Multa, NovaMulta> {
  protected readonly tabela = 'multas';
  protected readonly campos: CamposGravaveis<NovaMulta> = {
    reservaId: true,
    diasAtraso: true,
    valor: true,
    quitada: true,
    dataQuitacao: true
  };
  protected override readonly camposBooleanos = ['quitada'] as const;

  buscarPorReserva(reservaId: number): Promise<Multa | null> {
    return this.buscarUm('reserva_id = ?', [reservaId]);
  }

  /** Filtros da tela de multas. O cliente vem da reserva (JOIN). Mais recentes primeiro. */
  async filtrar(filtro: FiltroMultas = {}): Promise<Multa[]> {
    const condicoes: string[] = [];
    const params: ParametroSql[] = [];
    if (filtro.quitada !== undefined) {
      condicoes.push('m.quitada = ?');
      params.push(filtro.quitada ? 1 : 0);
    }
    if (filtro.clienteId !== undefined) {
      condicoes.push('r.cliente_id = ?');
      params.push(filtro.clienteId);
    }
    const onde = condicoes.length ? ` WHERE ${condicoes.join(' AND ')}` : '';
    const linhas = await this.db.consultar<Linha>(
      `SELECT m.* FROM multas m JOIN reservas r ON r.id = m.reserva_id${onde} ORDER BY m.created_at DESC, m.id DESC`,
      params
    );
    return linhas.map((linha) => this.paraEntidade(linha));
  }

  /** Volta a multa para "em aberto" (ex.: um pagamento dela foi estornado). */
  async reabrir(id: number): Promise<boolean> {
    const { linhasAfetadas } = await this.db.executar(
      'UPDATE multas SET quitada = 0, data_quitacao = NULL WHERE id = ? AND quitada = 1',
      [id]
    );
    return linhasAfetadas > 0;
  }

  listarEmAberto(): Promise<Multa[]> {
    return this.selecionar('quitada = 0', [], 'ORDER BY created_at, id');
  }

  /** Marca como quitada com a data/hora do banco. Devolve `false` se já estava quitada. */
  async quitar(id: number): Promise<boolean> {
    const { linhasAfetadas } = await this.db.executar(
      'UPDATE multas SET quitada = 1, data_quitacao = NOW() WHERE id = ? AND quitada = 0',
      [id]
    );
    return linhasAfetadas > 0;
  }
}
