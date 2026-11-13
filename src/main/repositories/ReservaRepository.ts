import type { DataISO, Paginado } from '@shared/dto/resposta';
import type { StatusReserva } from '@shared/models/enums';
import type { NovaReserva, Reserva } from '@shared/models/entidades';
import type { ParametroSql } from '../database/Database';
import {
  BaseRepository,
  POR_PAGINA_MAXIMO,
  POR_PAGINA_PADRAO,
  type CamposGravaveis
} from './BaseRepository';

export interface FiltroReservas {
  status?: StatusReserva;
  clienteId?: number;
  dataInicio?: DataISO;
  dataFim?: DataISO;
}

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

  /**
   * Filtros combináveis da tela de reservas, com paginação no banco.
   * Período: reservas que tocam o intervalo [dataInicio, dataFim] (bordas inclusivas).
   * Mais recentes primeiro.
   */
  async filtrar(
    filtro: FiltroReservas = {},
    opcoes: { pagina?: number; porPagina?: number } = {}
  ): Promise<Paginado<Reserva>> {
    const condicoes: string[] = [];
    const params: ParametroSql[] = [];
    if (filtro.status) {
      condicoes.push('status = ?');
      params.push(filtro.status);
    }
    if (filtro.clienteId !== undefined) {
      condicoes.push('cliente_id = ?');
      params.push(filtro.clienteId);
    }
    if (filtro.dataFim) {
      condicoes.push('data_retirada <= ?');
      params.push(filtro.dataFim);
    }
    if (filtro.dataInicio) {
      condicoes.push('data_devolucao_prevista >= ?');
      params.push(filtro.dataInicio);
    }
    const onde = condicoes.join(' AND ');
    const pagina = Math.max(1, Math.floor(opcoes.pagina ?? 1) || 1);
    const porPagina = Math.min(
      POR_PAGINA_MAXIMO,
      Math.max(1, Math.floor(opcoes.porPagina ?? POR_PAGINA_PADRAO) || POR_PAGINA_PADRAO)
    );
    const [itens, total] = await Promise.all([
      this.selecionar(onde, params, 'ORDER BY data_retirada DESC, id DESC LIMIT ? OFFSET ?', [
        porPagina,
        (pagina - 1) * porPagina
      ]),
      this.contarOnde(onde, params)
    ]);
    return { itens, total, pagina, porPagina };
  }

  /** Busca e TRAVA a reserva até o fim da transação (ver EquipamentoRepository.travarPorIds). */
  async travar(id: number): Promise<Reserva | null> {
    const [reserva] = await this.selecionar('id = ?', [id], 'FOR UPDATE');
    return reserva ?? null;
  }

  async atualizarStatus(id: number, status: StatusReserva): Promise<boolean> {
    const { linhasAfetadas } = await this.db.executar(
      'UPDATE reservas SET status = ? WHERE id = ?',
      [status, id]
    );
    return linhasAfetadas > 0;
  }
}
