import type { DataISO } from '@shared/dto/resposta';
import type { Equipamento, ItemReserva, Reserva } from '@shared/models/entidades';
import { CalendarioISO } from '../../domain/CalendarioISO';
import { Dinheiro } from '../../domain/Dinheiro';
import { EquipamentoDominio } from '../../domain/EquipamentoDominio';
import { Periodo } from '../../domain/Periodo';
import { ReservaDominio, type ItemDaReserva } from '../../domain/ReservaDominio';
import { NaoEncontradoError, RegraNegocioError, ValidacaoError } from '../../errors/DominioError';
import { EquipamentoIndisponivelError } from '../../errors/ReservaErrors';
import type { Repositorios } from '../../repositories';
import { DisponibilidadeService } from '../DisponibilidadeService';

/**
 * Passos reaproveitados pelo ReservaService e pelo ItemReservaService.
 * Uma instância por transação: recebe os repositórios da transação (`tx`).
 *
 * ⚠ Ordem importa para a concorrência no MySQL (InnoDB, REPEATABLE READ):
 * as TRAVAS (`travarReserva`, `itensReserva.travarDaReserva`, `travarEquipamentos`)
 * devem vir antes de qualquer leitura comum. Leituras comuns "congelam" uma foto
 * do banco na primeira vez que rodam; se a foto fosse tirada antes de esperar a
 * trava, a transação não enxergaria a reserva que a outra acabou de gravar e a
 * checagem de disponibilidade deixaria passar uma reserva dupla.
 * Ordem das travas, sempre: reserva → itens → equipamentos (evita deadlock).
 */
export class OperacoesReserva {
  constructor(private readonly repos: Repositorios) {}

  /** Trava a reserva e confere se existe. */
  async travarReserva(id: number): Promise<Reserva> {
    const reserva = await this.repos.reservas.travar(id);
    if (!reserva) throw new NaoEncontradoError('Reserva', id);
    return reserva;
  }

  /** Trava os equipamentos (em ordem de id) e confere se todos existem. */
  async travarEquipamentos(ids: number[]): Promise<Equipamento[]> {
    const equipamentos = await this.repos.equipamentos.travarPorIds(ids);
    for (const id of ids) {
      if (!equipamentos.some((e) => e.id === id)) throw new NaoEncontradoError('Equipamento', id);
    }
    return equipamentos;
  }

  async garantirCliente(clienteId: number): Promise<void> {
    if (!(await this.repos.clientes.buscarPorId(clienteId))) {
      throw new ValidacaoError('Cliente não encontrado.', { clienteId: 'Escolha um cliente.' });
    }
  }

  /** Todos livres no período? Senão, lança erro dizendo qual item e por quê. */
  async garantirDisponiveis(
    equipamentos: Equipamento[],
    periodo: Periodo,
    ignorarReservaId?: number
  ): Promise<void> {
    const disponibilidade = new DisponibilidadeService(
      this.repos.equipamentos,
      this.repos.manutencoes,
      this.repos.reservas
    );
    for (const equipamento of equipamentos) {
      const motivo = await disponibilidade.motivoIndisponibilidade(
        equipamento,
        periodo,
        ignorarReservaId
      );
      if (motivo) throw new EquipamentoIndisponivelError(equipamento.nome, motivo);
    }
  }

  static garantirPendente(reserva: Reserva, acao: string): void {
    if (reserva.status !== 'PENDENTE') {
      throw new RegraNegocioError(
        `Só é possível ${acao} reservas PENDENTES (esta está ${reserva.status}).`
      );
    }
  }

  /** Reservas novas (ou com datas alteradas) não podem começar no passado. */
  static garantirRetiradaNaoPassada(periodo: Periodo, hoje: DataISO): void {
    if (CalendarioISO.diasEntre(hoje, periodo.retirada) < 0) {
      throw new ValidacaoError('A data de retirada não pode estar no passado.', {
        dataRetirada: 'Escolha hoje ou uma data futura.'
      });
    }
  }

  static garantirSemRepetidos(ids: number[]): void {
    if (new Set(ids).size !== ids.length) {
      throw new ValidacaoError('O mesmo equipamento foi escolhido mais de uma vez.');
    }
  }

  /** Itens novos: a diária vem do cadastro do equipamento, nunca da tela. */
  static itensDeEquipamentos(equipamentos: Equipamento[]): ItemDaReserva[] {
    return equipamentos.map((e) => ({
      equipamentoId: e.id,
      diaria: new EquipamentoDominio(e).diaria()
    }));
  }

  /** Itens já gravados: usa a diária "congelada" no item. */
  static itensGravados(itens: ItemReserva[]): ItemDaReserva[] {
    return itens.map((i) => ({
      equipamentoId: i.equipamentoId,
      diaria: Dinheiro.deReais(i.valorDiaria)
    }));
  }

  static periodoDe(reserva: Reserva): Periodo {
    return new Periodo(reserva.dataRetirada, reserva.dataDevolucaoPrevista);
  }

  static dominioDe(reserva: Reserva, itens: ItemReserva[]): ReservaDominio {
    return ReservaDominio.restaurar({
      status: reserva.status,
      periodo: OperacoesReserva.periodoDe(reserva),
      itens: OperacoesReserva.itensGravados(itens),
      valorCaucao: Dinheiro.deReais(reserva.valorCaucao),
      caucaoStatus: reserva.caucaoStatus,
      dataDevolucaoReal: reserva.dataDevolucaoReal ?? undefined
    });
  }

  /** Grava os itens copiando diária e estado atual de cada equipamento. */
  async criarItens(reservaId: number, equipamentos: Equipamento[]): Promise<void> {
    for (const e of equipamentos) {
      await this.repos.itensReserva.criar({
        reservaId,
        equipamentoId: e.id,
        valorDiaria: new EquipamentoDominio(e).diaria().emReais(),
        estadoRetirada: e.estadoConservacao
      });
    }
  }

  /** Recalcula `valor_total` depois de mudar itens (soma das diárias × diárias). */
  async recalcularTotal(reserva: Reserva): Promise<void> {
    const itens = await this.repos.itensReserva.listarPorReserva(reserva.id);
    const total = Dinheiro.somarTodos(OperacoesReserva.itensGravados(itens).map((i) => i.diaria))
      .multiplicar(OperacoesReserva.periodoDe(reserva).diarias())
      .emReais();
    await this.repos.reservas.atualizar(reserva.id, { valorTotal: total });
  }
}
