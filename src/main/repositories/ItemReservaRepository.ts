import type { EstadoConservacao } from '@shared/models/enums';
import type { ItemReserva, NovoItemReserva } from '@shared/models/entidades';
import { BaseRepository, type CamposGravaveis } from './BaseRepository';

/** Tabela `itens_reserva`: cada equipamento de uma reserva, com a diária copiada na hora. */
export class ItemReservaRepository extends BaseRepository<ItemReserva, NovoItemReserva> {
  protected readonly tabela = 'itens_reserva';
  protected readonly campos: CamposGravaveis<NovoItemReserva> = {
    reservaId: true,
    equipamentoId: true,
    valorDiaria: true,
    estadoRetirada: true,
    estadoDevolucao: true
  };

  listarPorReserva(reservaId: number): Promise<ItemReserva[]> {
    return this.selecionar('reserva_id = ?', [reservaId]);
  }

  listarPorEquipamento(equipamentoId: number): Promise<ItemReserva[]> {
    return this.selecionar('equipamento_id = ?', [equipamentoId], 'ORDER BY id DESC');
  }

  async registrarDevolucao(id: number, estadoDevolucao: EstadoConservacao): Promise<boolean> {
    const { linhasAfetadas } = await this.db.executar(
      'UPDATE itens_reserva SET estado_devolucao = ? WHERE id = ?',
      [estadoDevolucao, id]
    );
    return linhasAfetadas > 0;
  }

  /** Apaga todos os itens de uma reserva (usado ao trocar os itens de uma reserva PENDENTE). */
  async excluirDaReserva(reservaId: number): Promise<number> {
    const { linhasAfetadas } = await this.db.executar(
      'DELETE FROM itens_reserva WHERE reserva_id = ?',
      [reservaId]
    );
    return linhasAfetadas;
  }
}
