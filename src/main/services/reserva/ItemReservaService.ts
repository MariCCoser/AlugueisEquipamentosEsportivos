import type { ReservaIdDTO } from '@shared/dto/comum.dto';
import type {
  AtualizarItemReservaDTO,
  CriarItemReservaDTO,
  ItemReservaDTO
} from '@shared/dto/reserva.dto';
import type { ItemReserva } from '@shared/models/entidades';
import { EquipamentoDominio } from '../../domain/EquipamentoDominio';
import { NaoEncontradoError, RegraNegocioError } from '../../errors/DominioError';
import { ReservaMontador } from '../mapeadores/ReservaMontador';
import type { AcessoDados } from '../UnidadeDeTrabalho';
import { OperacoesReserva } from './OperacoesReserva';

/**
 * Itens de uma reserva PENDENTE: adicionar, trocar o equipamento ou remover.
 * Cada mudança confere a disponibilidade e recalcula o valor total da reserva.
 */
export class ItemReservaService {
  constructor(private readonly dados: AcessoDados) {}

  async criar({ reservaId, equipamentoId }: CriarItemReservaDTO): Promise<ItemReservaDTO> {
    const itemId = await this.dados.transacao(async (repos) => {
      const ops = new OperacoesReserva(repos);
      const reserva = await ops.travarReserva(reservaId);
      const [equipamento] = await ops.travarEquipamentos([equipamentoId]);
      OperacoesReserva.garantirPendente(reserva, 'alterar itens de');

      const itens = await repos.itensReserva.listarPorReserva(reservaId);
      if (itens.some((i) => i.equipamentoId === equipamentoId)) {
        throw new RegraNegocioError('Este equipamento já está na reserva.');
      }
      await ops.garantirDisponiveis([equipamento!], OperacoesReserva.periodoDe(reserva), reservaId);

      const item = await repos.itensReserva.criar({
        reservaId,
        equipamentoId,
        valorDiaria: new EquipamentoDominio(equipamento!).diaria().emReais(),
        estadoRetirada: equipamento!.estadoConservacao
      });
      await ops.recalcularTotal(reserva);
      return item.id;
    });
    return this.buscarPorId(itemId);
  }

  async listarPorReserva({ reservaId }: ReservaIdDTO): Promise<ItemReservaDTO[]> {
    if (!(await this.dados.repos.reservas.buscarPorId(reservaId))) {
      throw new NaoEncontradoError('Reserva', reservaId);
    }
    const itens = await this.dados.repos.itensReserva.listarPorReserva(reservaId);
    return new ReservaMontador(this.dados.repos).itens(itens);
  }

  async buscarPorId(id: number): Promise<ItemReservaDTO> {
    const [dto] = await new ReservaMontador(this.dados.repos).itens([await this.obter(id)]);
    return dto!;
  }

  /** Troca o equipamento do item; a diária é copiada de novo do equipamento novo. */
  async atualizar({ id, equipamentoId }: AtualizarItemReservaDTO): Promise<ItemReservaDTO> {
    // Leitura fora da transação só para descobrir a reserva (a trava vem primeiro lá dentro)
    const { reservaId } = await this.obter(id);
    await this.dados.transacao(async (repos) => {
      const ops = new OperacoesReserva(repos);
      const reserva = await ops.travarReserva(reservaId);
      const [equipamento] = await ops.travarEquipamentos([equipamentoId]);
      OperacoesReserva.garantirPendente(reserva, 'alterar itens de');

      const itens = await repos.itensReserva.listarPorReserva(reservaId);
      const item = itens.find((i) => i.id === id);
      if (!item) throw new NaoEncontradoError('Item da reserva', id);
      if (item.equipamentoId === equipamentoId) return;
      if (itens.some((i) => i.equipamentoId === equipamentoId)) {
        throw new RegraNegocioError('Este equipamento já está na reserva.');
      }
      await ops.garantirDisponiveis([equipamento!], OperacoesReserva.periodoDe(reserva), reservaId);

      await repos.itensReserva.atualizar(id, {
        equipamentoId,
        valorDiaria: new EquipamentoDominio(equipamento!).diaria().emReais(),
        estadoRetirada: equipamento!.estadoConservacao
      });
      await ops.recalcularTotal(reserva);
    });
    return this.buscarPorId(id);
  }

  /** Remove o item; a reserva precisa continuar com pelo menos um. */
  async excluir(id: number): Promise<void> {
    const { reservaId } = await this.obter(id);
    await this.dados.transacao(async (repos) => {
      const ops = new OperacoesReserva(repos);
      const reserva = await ops.travarReserva(reservaId);
      OperacoesReserva.garantirPendente(reserva, 'alterar itens de');

      const itens = await repos.itensReserva.listarPorReserva(reservaId);
      if (!itens.some((i) => i.id === id)) throw new NaoEncontradoError('Item da reserva', id);
      if (itens.length === 1) {
        throw new RegraNegocioError(
          'A reserva precisa de pelo menos um equipamento. Para desistir, cancele a reserva.'
        );
      }
      await repos.itensReserva.excluir(id);
      await ops.recalcularTotal(reserva);
    });
  }

  private async obter(id: number): Promise<ItemReserva> {
    const item = await this.dados.repos.itensReserva.buscarPorId(id);
    if (!item) throw new NaoEncontradoError('Item da reserva', id);
    return item;
  }
}
