import type {
  AtualizarMultaDTO,
  CalcularMultaDTO,
  CriarMultaDTO,
  FiltroMultaDTO,
  MultaCalculadaDTO,
  MultaDTO,
  QuitarMultaDTO
} from '@shared/dto/multa.dto';
import type { Multa } from '@shared/models/entidades';
import { Dinheiro } from '../../domain/Dinheiro';
import { NaoEncontradoError, RegraNegocioError } from '../../errors/ErroApp';
import { TradutorErroBanco } from '../../errors/TradutorErroBanco';
import { ReservaMontador } from '../mapeadores/ReservaMontador';
import type { EstrategiaMulta } from '../multa/EstrategiaMulta';
import { OperacoesReserva } from '../reserva/OperacoesReserva';
import type { AcessoDados } from '../UnidadeDeTrabalho';
import { SituacaoMulta } from './SituacaoMulta';

/**
 * Multas por atraso. A multa automática nasce na devolução (DevolucaoService);
 * aqui ficam a simulação, o lançamento manual (ADMIN), as correções e a quitação.
 */
export class MultaService {
  constructor(
    private readonly dados: AcessoDados,
    private readonly estrategia: EstrategiaMulta
  ) {}

  /** "Quanto daria de multa se devolvesse nesta data?" — não grava nada. */
  async calcular({ reservaId, dataDevolucao }: CalcularMultaDTO): Promise<MultaCalculadaDTO> {
    const reserva = await this.dados.repos.reservas.buscarPorId(reservaId);
    if (!reserva) throw new NaoEncontradoError('Reserva', reservaId);
    if (reserva.status !== 'ATIVA') {
      throw new RegraNegocioError('Só dá para simular a multa de uma reserva ATIVA.');
    }
    const itens = await this.dados.repos.itensReserva.listarPorReserva(reservaId);
    const dominio = OperacoesReserva.dominioDe(reserva, itens);
    const diasAtraso = dominio.periodo.diasAtraso(dataDevolucao);
    const valor = this.estrategia.calcular({ diasAtraso, somaDiarias: dominio.somaDiarias() });
    return { diasAtraso, valor: valor.emReais(), estrategia: this.estrategia.tipo };
  }

  /** Lançamento manual (ADMIN). Uma multa por reserva. */
  async criar({ reservaId, diasAtraso, valor }: CriarMultaDTO): Promise<MultaDTO> {
    const reserva = await this.dados.repos.reservas.buscarPorId(reservaId);
    if (!reserva) throw new NaoEncontradoError('Reserva', reservaId);
    if (reserva.status !== 'ATIVA' && reserva.status !== 'DEVOLVIDA') {
      throw new RegraNegocioError('Só reservas ATIVAS ou DEVOLVIDAS podem receber multa.');
    }
    if (await this.dados.repos.multas.buscarPorReserva(reservaId)) {
      throw new RegraNegocioError('Esta reserva já tem multa. Corrija a existente.');
    }
    const multa = await TradutorErroBanco.proteger(
      () =>
        this.dados.repos.multas.criar({
          reservaId,
          diasAtraso,
          valor: Dinheiro.deReais(valor).emReais()
        }),
      { duplicado: 'Esta reserva já tem multa. Corrija a existente.' }
    );
    return this.paraDTO(multa);
  }

  async listar(filtro: FiltroMultaDTO = {}): Promise<MultaDTO[]> {
    return this.paraDTOs(await this.dados.repos.multas.filtrar(filtro));
  }

  async listarEmAberto(): Promise<MultaDTO[]> {
    return this.paraDTOs(await this.dados.repos.multas.listarEmAberto());
  }

  async buscarPorId(id: number): Promise<MultaDTO> {
    return this.paraDTO(await this.obter(id));
  }

  /** Correção (ADMIN). Multa quitada não muda; o valor não pode ficar abaixo do já pago. */
  async atualizar({ id, diasAtraso, valor }: AtualizarMultaDTO): Promise<MultaDTO> {
    const multa = await this.obter(id);
    if (multa.quitada) throw new RegraNegocioError('Multa quitada não pode ser alterada.');
    if (valor !== undefined) {
      const pago = await new SituacaoMulta(this.dados.repos).valorPago(id);
      if (!Dinheiro.deReais(valor).maiorOuIgual(pago)) {
        throw new RegraNegocioError(
          `O valor não pode ser menor que o já pago (${pago.formatar()}).`
        );
      }
    }
    await this.dados.repos.multas.atualizar(id, { diasAtraso, valor });
    await new SituacaoMulta(this.dados.repos).atualizar(id);
    return this.buscarPorId(id);
  }

  /** Só multa sem pagamentos (para apagar, estorne os pagamentos antes). */
  async excluir(id: number): Promise<void> {
    await this.obter(id);
    if ((await this.dados.repos.pagamentos.listarPorMulta(id)).length > 0) {
      throw new RegraNegocioError('A multa tem pagamentos. Estorne-os antes de excluir.');
    }
    await TradutorErroBanco.proteger(() => this.dados.repos.multas.excluir(id), {
      emUso: 'A multa tem pagamentos. Estorne-os antes de excluir.'
    });
  }

  /** Paga o que falta da multa de uma vez e marca como quitada. */
  async quitar({ multaId, forma }: QuitarMultaDTO): Promise<MultaDTO> {
    const { reservaId } = await this.obter(multaId);
    await this.dados.transacao(async (repos) => {
      await new OperacoesReserva(repos).travarReserva(reservaId);
      const multa = await repos.multas.buscarPorId(multaId);
      if (!multa) throw new NaoEncontradoError('Multa', multaId);
      if (multa.quitada) throw new RegraNegocioError('Esta multa já está quitada.');

      const situacao = new SituacaoMulta(repos);
      const saldo = await situacao.saldo(multa);
      if (!saldo.ehZero()) {
        await repos.pagamentos.criar({
          reservaId,
          multaId,
          tipo: 'MULTA',
          forma,
          valor: saldo.emReais()
        });
      }
      await situacao.atualizar(multaId);
    });
    return this.buscarPorId(multaId);
  }

  // ---------- auxiliares ----------

  private async obter(id: number): Promise<Multa> {
    const multa = await this.dados.repos.multas.buscarPorId(id);
    if (!multa) throw new NaoEncontradoError('Multa', id);
    return multa;
  }

  private async paraDTO(multa: Multa): Promise<MultaDTO> {
    const [dto] = await this.paraDTOs([multa]);
    return dto!;
  }

  /** O nome do cliente vem da reserva da multa. */
  private async paraDTOs(multas: Multa[]): Promise<MultaDTO[]> {
    const montador = new ReservaMontador(this.dados.repos);
    const resultado: MultaDTO[] = [];
    for (const multa of multas) {
      const reserva = await this.dados.repos.reservas.buscarPorId(multa.reservaId);
      const cliente = reserva
        ? await this.dados.repos.clientes.buscarPorId(reserva.clienteId)
        : null;
      resultado.push(await montador.multa(multa, cliente?.nome ?? ''));
    }
    return resultado;
  }
}
