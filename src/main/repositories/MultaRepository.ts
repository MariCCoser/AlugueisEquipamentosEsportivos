import type { Multa, NovaMulta } from '@shared/models/entidades';
import { BaseRepository, type CamposGravaveis } from './BaseRepository';

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
