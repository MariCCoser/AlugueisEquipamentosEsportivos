import type { DevolucaoResultadoDTO, RegistrarDevolucaoDTO } from '@shared/dto/devolucao.dto';
import type { DataISO } from '@shared/dto/resposta';
import type { ItemReserva, Multa, Reserva } from '@shared/models/entidades';
import { CalendarioISO } from '../../domain/CalendarioISO';
import { Dinheiro } from '../../domain/Dinheiro';
import { RegraNegocioError, ValidacaoError } from '../../errors/ErroApp';
import type { Repositorios } from '../../repositories';
import { SituacaoMulta } from '../financeiro/SituacaoMulta';
import { ReservaMontador } from '../mapeadores/ReservaMontador';
import type { EstrategiaMulta } from '../multa/EstrategiaMulta';
import type { AcessoDados } from '../UnidadeDeTrabalho';
import { OperacoesReserva } from './OperacoesReserva';

/**
 * Registra a devolução (ATIVA → DEVOLVIDA), tudo numa transação:
 * 1. grava o estado de cada item na volta e atualiza a conservação do equipamento;
 * 2. libera os equipamentos (RESERVADO → DISPONIVEL);
 * 3. se atrasou, gera a multa pela EstrategiaMulta configurada;
 * 4. se pedido (`reterCaucao`), usa a caução JÁ PAGA para abater a multa.
 */
export class DevolucaoService {
  constructor(
    private readonly dados: AcessoDados,
    private readonly estrategia: EstrategiaMulta,
    private readonly hoje: () => DataISO
  ) {}

  async registrar(entrada: RegistrarDevolucaoDTO): Promise<DevolucaoResultadoDTO> {
    if (CalendarioISO.diasEntre(this.hoje(), entrada.dataDevolucaoReal) > 0) {
      throw new ValidacaoError('A data de devolução não pode estar no futuro.', {
        dataDevolucaoReal: 'Use hoje ou uma data passada.'
      });
    }

    const { multaGeradaId, liberados } = await this.dados.transacao(async (repos) => {
      const ops = new OperacoesReserva(repos);
      const reserva = await ops.travarReserva(entrada.reservaId); // travas primeiro
      const itens = await repos.itensReserva.travarDaReserva(reserva.id);
      const equipamentos = await ops.travarEquipamentos(itens.map((i) => i.equipamentoId));

      const estados = DevolucaoService.estadosPorItem(entrada, itens);
      const dominio = OperacoesReserva.dominioDe(reserva, itens);
      const diasAtraso = dominio.registrarDevolucao(entrada.dataDevolucaoReal); // valida ATIVA

      const liberados: number[] = [];
      for (const item of itens) {
        const estado = estados.get(item.id)!;
        const equipamento = equipamentos.find((e) => e.id === item.equipamentoId)!;
        await repos.itensReserva.registrarDevolucao(item.id, estado);
        await repos.equipamentos.atualizar(equipamento.id, { estadoConservacao: estado });
        if (equipamento.status === 'RESERVADO') {
          await repos.equipamentos.atualizarStatus(equipamento.id, 'DISPONIVEL');
          liberados.push(equipamento.id);
        }
      }
      await repos.reservas.atualizar(reserva.id, {
        status: 'DEVOLVIDA',
        dataDevolucaoReal: entrada.dataDevolucaoReal
      });

      let multa: Multa | null = null;
      if (diasAtraso > 0) {
        if (await repos.multas.buscarPorReserva(reserva.id)) {
          throw new RegraNegocioError(
            'Esta reserva já tem uma multa lançada à mão. Ajuste-a em Multas antes de devolver.'
          );
        }
        const valor = this.estrategia.calcular({ diasAtraso, somaDiarias: dominio.somaDiarias() });
        multa = await repos.multas.criar({
          reservaId: reserva.id,
          diasAtraso,
          valor: valor.emReais()
        });
        if (entrada.reterCaucao) await DevolucaoService.abaterComCaucao(repos, reserva, multa);
      }
      return { multaGeradaId: multa?.id ?? null, liberados };
    });

    const reserva = await this.dados.repos.reservas.buscarPorId(entrada.reservaId);
    const dto = await new ReservaMontador(this.dados.repos).completa(reserva!);
    const resultado: DevolucaoResultadoDTO = { reserva: dto, equipamentosLiberados: liberados };
    if (multaGeradaId !== null && dto.multa) resultado.multaGerada = dto.multa;
    return resultado;
  }

  /** Um estado para cada item da reserva — nem a mais, nem a menos, nem repetido. */
  static estadosPorItem(
    entrada: RegistrarDevolucaoDTO,
    itens: ItemReserva[]
  ): Map<number, ItemReserva['estadoRetirada']> {
    const estados = new Map(entrada.itens.map((i) => [i.itemReservaId, i.estadoDevolucao]));
    const idsDaReserva = new Set(itens.map((i) => i.id));
    const completo =
      estados.size === entrada.itens.length &&
      estados.size === idsDaReserva.size &&
      [...estados.keys()].every((id) => idsDaReserva.has(id));
    if (!completo) {
      throw new ValidacaoError('Informe o estado de cada equipamento da reserva, uma vez só.', {
        itens: `A reserva tem ${idsDaReserva.size} item(ns).`
      });
    }
    return estados;
  }

  /**
   * Usa a caução que o cliente JÁ PAGOU para abater a multa.
   * Contabilidade: o dinheiro não entra duas vezes — o valor usado sai do(s)
   * pagamento(s) de CAUCAO e vira um pagamento de MULTA na mesma forma (PIX,
   * dinheiro...). O que sobrar da caução continua retido, para devolver depois.
   */
  static async abaterComCaucao(repos: Repositorios, reserva: Reserva, multa: Multa): Promise<void> {
    if (reserva.caucaoStatus !== 'RETIDA') return;
    const pagamentosCaucao = (await repos.pagamentos.listarPorReserva(reserva.id)).filter(
      (p) => p.tipo === 'CAUCAO'
    );
    let falta = Dinheiro.deReais(multa.valor);
    for (const pagamento of pagamentosCaucao) {
      if (falta.ehZero()) break;
      const disponivel = Dinheiro.deReais(pagamento.valor);
      const usar = disponivel.maiorOuIgual(falta) ? falta : disponivel;
      const sobra = disponivel.subtrair(usar);
      if (sobra.ehZero()) {
        await repos.pagamentos.excluir(pagamento.id);
      } else {
        await repos.pagamentos.atualizar(pagamento.id, { valor: sobra.emReais() });
      }
      await repos.pagamentos.criar({
        reservaId: reserva.id,
        multaId: multa.id,
        tipo: 'MULTA',
        forma: pagamento.forma,
        valor: usar.emReais()
      });
      falta = falta.subtrair(usar);
    }
    await new SituacaoMulta(repos).atualizar(multa.id);
  }
}
