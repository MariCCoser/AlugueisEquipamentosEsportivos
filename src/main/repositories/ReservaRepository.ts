import type { DataISO } from '@shared/dto/resposta';
import type { StatusReserva } from '@shared/models/enums';
import type { NovaReserva, Reserva } from '@shared/models/entidades';
import type { ParametroSql } from '../database/Database';
import { BaseRepository, type CamposGravaveis } from './BaseRepository';

/** Status em que a reserva "segura" o equipamento no período. */
export const STATUS_QUE_BLOQUEIAM: readonly StatusReserva[] = ['PENDENTE', 'ATIVA'];

/** Tabela `reservas`. Os equipamentos de cada reserva ficam em `itens_reserva`. */
export class ReservaRepository extends BaseRepository<Reserva, NovaReserva> {
  protected readonly tabela = 'reservas';
  protected readonly campos: CamposGravaveis<NovaReserva> = {
    clienteId: true,
    usuarioId: true,
    dataRetirada: true,
    dataDevolucaoPrevista: true,
    dataDevolucaoReal: true,
    status: true,
    valorTotal: true,
    valorCaucao: true,
    caucaoStatus: true,
    observacoes: true
  };

  listarPorStatus(status: StatusReserva): Promise<Reserva[]> {
    return this.selecionar('status = ?', [status], 'ORDER BY data_retirada, id');
  }

  listarPorCliente(clienteId: number): Promise<Reserva[]> {
    return this.selecionar('cliente_id = ?', [clienteId], 'ORDER BY data_retirada DESC, id DESC');
  }

  /** Reservas ATIVAS cuja devolução prevista já passou de `hoje`. */
  listarAtrasadas(hoje: DataISO): Promise<Reserva[]> {
    return this.selecionar(
      "status = 'ATIVA' AND data_devolucao_prevista < ?",
      [hoje],
      'ORDER BY data_devolucao_prevista, id'
    );
  }

  /**
   * O equipamento já está em outra reserva PENDENTE/ATIVA que cruza o período?
   * Dois períodos se cruzam quando um começa antes (ou no dia) do outro terminar, e vice-versa.
   * Use `ignorarReservaId` ao editar uma reserva, para ela não conflitar com ela mesma.
   */
  async equipamentoReservadoNoPeriodo(
    equipamentoId: number,
    dataRetirada: DataISO,
    dataDevolucaoPrevista: DataISO,
    ignorarReservaId?: number
  ): Promise<boolean> {
    const statusMarcadores = STATUS_QUE_BLOQUEIAM.map(() => '?').join(', ');
    const params: ParametroSql[] = [
      equipamentoId,
      ...STATUS_QUE_BLOQUEIAM,
      dataDevolucaoPrevista,
      dataRetirada
    ];
    let sql =
      'SELECT COUNT(*) AS total FROM itens_reserva ir ' +
      'JOIN reservas r ON r.id = ir.reserva_id ' +
      `WHERE ir.equipamento_id = ? AND r.status IN (${statusMarcadores}) ` +
      'AND r.data_retirada <= ? AND r.data_devolucao_prevista >= ?';
    if (ignorarReservaId !== undefined) {
      sql += ' AND r.id <> ?';
      params.push(ignorarReservaId);
    }
    const [linha] = await this.db.consultar<{ total: number | string }>(sql, params);
    return Number(linha?.total ?? 0) > 0;
  }

  async atualizarStatus(id: number, status: StatusReserva): Promise<boolean> {
    const { linhasAfetadas } = await this.db.executar(
      'UPDATE reservas SET status = ? WHERE id = ?',
      [status, id]
    );
    return linhasAfetadas > 0;
  }
}
