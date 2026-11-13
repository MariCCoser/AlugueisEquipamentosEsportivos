import type { ReservaIdDTO } from '@shared/dto/comum.dto';
import type {
  AtualizarPagamentoDTO,
  CriarPagamentoDTO,
  DevolverCaucaoDTO,
  FiltroPagamentoDTO,
  PagamentoDTO
} from '@shared/dto/pagamento.dto';
import type { ReservaDTO } from '@shared/dto/reserva.dto';
import type { Pagamento, Reserva } from '@shared/models/entidades';
import type { TipoPagamento } from '@shared/models/enums';
import { Dinheiro } from '../../domain/Dinheiro';
import { NaoEncontradoError, RegraNegocioError, ValidacaoError } from '../../errors/ErroApp';
import type { Repositorios } from '../../repositories';
import { PagamentoMapper } from '../mapeadores/PagamentoMapper';
import { ReservaMontador } from '../mapeadores/ReservaMontador';
import { OperacoesReserva } from '../reserva/OperacoesReserva';
import type { AcessoDados } from '../UnidadeDeTrabalho';
import { SituacaoMulta } from './SituacaoMulta';

/**
 * Todo dinheiro da reserva: aluguel, caução e multa.
 *
 * Regras que a FK não garante:
 * - tipo MULTA ⇔ `multaId` preenchido (e a multa é desta reserva);
 * - ninguém paga mais do que deve (aluguel, caução ou saldo da multa);
 * - reserva CANCELADA não recebe pagamento novo;
 * - a multa vira "quitada" (ou volta a ficar em aberto) sozinha, conforme os pagamentos.
 *
 * Cada gravação trava a reserva: dois pagamentos simultâneos da mesma reserva
 * não conseguem passar juntos do valor devido.
 */
export class PagamentoService {
  constructor(private readonly dados: AcessoDados) {}

  async criar(entrada: CriarPagamentoDTO): Promise<PagamentoDTO> {
    PagamentoService.validarTipo(entrada.tipo, entrada.multaId);
    const valor = Dinheiro.deReais(entrada.valor);

    const pagamento = await this.dados.transacao(async (repos) => {
      const reserva = await new OperacoesReserva(repos).travarReserva(entrada.reservaId);
      if (reserva.status === 'CANCELADA') {
        throw new RegraNegocioError('Reserva cancelada não recebe pagamentos.');
      }
      const devido = await PagamentoService.devido(repos, reserva, entrada.tipo, entrada.multaId);
      PagamentoService.garantirNaoPassa(valor, devido);

      const criado = await repos.pagamentos.criar({
        reservaId: reserva.id,
        multaId: entrada.multaId ?? null,
        tipo: entrada.tipo,
        forma: entrada.forma,
        valor: valor.emReais()
      });
      if (criado.multaId != null) await new SituacaoMulta(repos).atualizar(criado.multaId);
      return criado;
    });
    return PagamentoMapper.paraDTO(pagamento);
  }

  async listar(filtro: FiltroPagamentoDTO = {}): Promise<PagamentoDTO[]> {
    const pagamentos = await this.dados.repos.pagamentos.filtrar(filtro);
    return pagamentos.map((p) => PagamentoMapper.paraDTO(p));
  }

  async listarPorReserva({ reservaId }: ReservaIdDTO): Promise<PagamentoDTO[]> {
    if (!(await this.dados.repos.reservas.buscarPorId(reservaId))) {
      throw new NaoEncontradoError('Reserva', reservaId);
    }
    const pagamentos = await this.dados.repos.pagamentos.listarPorReserva(reservaId);
    return pagamentos.map((p) => PagamentoMapper.paraDTO(p));
  }

  async buscarPorId(id: number): Promise<PagamentoDTO> {
    return PagamentoMapper.paraDTO(await this.obter(id));
  }

  /** Correção de forma/valor (ADMIN). O novo valor também não pode passar do devido. */
  async atualizar({ id, forma, valor }: AtualizarPagamentoDTO): Promise<PagamentoDTO> {
    const { reservaId } = await this.obter(id);
    const atualizado = await this.dados.transacao(async (repos) => {
      const reserva = await new OperacoesReserva(repos).travarReserva(reservaId);
      const atual = await PagamentoService.obterEm(repos, id);
      if (valor !== undefined) {
        // O próprio lançamento sai da conta do que já foi pago
        const devido = (
          await PagamentoService.devido(repos, reserva, atual.tipo, atual.multaId ?? undefined)
        ).somar(Dinheiro.deReais(atual.valor));
        PagamentoService.garantirNaoPassa(Dinheiro.deReais(valor), devido);
      }
      const novo = await repos.pagamentos.atualizar(id, { forma, valor });
      if (atual.multaId != null) await new SituacaoMulta(repos).atualizar(atual.multaId);
      return novo!;
    });
    return PagamentoMapper.paraDTO(atualizado);
  }

  /** Estorno (ADMIN). Se era de multa, a multa pode voltar a ficar em aberto. */
  async excluir(id: number): Promise<void> {
    const { reservaId } = await this.obter(id);
    await this.dados.transacao(async (repos) => {
      await new OperacoesReserva(repos).travarReserva(reservaId);
      const atual = await PagamentoService.obterEm(repos, id);
      await repos.pagamentos.excluir(id);
      if (atual.multaId != null) await new SituacaoMulta(repos).atualizar(atual.multaId);
    });
  }

  /**
   * Fim da caução, depois que a reserva terminou (DEVOLVIDA ou CANCELADA):
   * `reter: false` → devolvida ao cliente; `reter: true` → a loja fica com ela
   * (anotado nas observações, ex.: para cobrir dano).
   */
  async devolverCaucao({ reservaId, reter }: DevolverCaucaoDTO): Promise<ReservaDTO> {
    await this.dados.transacao(async (repos) => {
      const reserva = await new OperacoesReserva(repos).travarReserva(reservaId);
      if (reserva.caucaoStatus !== 'RETIDA') {
        throw new RegraNegocioError('Esta reserva não tem caução retida.');
      }
      if (reserva.status !== 'DEVOLVIDA' && reserva.status !== 'CANCELADA') {
        throw new RegraNegocioError(
          'A caução só é resolvida depois da devolução ou do cancelamento.'
        );
      }
      if (reter) {
        await repos.reservas.atualizar(reservaId, {
          observacoes: PagamentoService.anotar(reserva.observacoes, 'Caução retida pela loja.')
        });
      } else {
        await repos.reservas.atualizar(reservaId, { caucaoStatus: 'DEVOLVIDA' });
      }
    });
    const reserva = await this.dados.repos.reservas.buscarPorId(reservaId);
    return new ReservaMontador(this.dados.repos).completa(reserva!);
  }

  // ---------- regras ----------

  static validarTipo(tipo: TipoPagamento, multaId: number | undefined): void {
    if (tipo === 'MULTA' && multaId === undefined) {
      throw new ValidacaoError('Informe qual multa está sendo paga.', {
        multaId: 'Obrigatório para pagamento de multa.'
      });
    }
    if (tipo !== 'MULTA' && multaId !== undefined) {
      throw new ValidacaoError('Só pagamento do tipo MULTA pode apontar para uma multa.', {
        multaId: 'Deixe vazio para aluguel ou caução.'
      });
    }
  }

  /** Quanto ainda falta pagar deste tipo, nesta reserva. */
  static async devido(
    repos: Repositorios,
    reserva: Reserva,
    tipo: TipoPagamento,
    multaId?: number
  ): Promise<Dinheiro> {
    if (tipo === 'MULTA') {
      const multa = await repos.multas.buscarPorId(multaId!);
      if (!multa || multa.reservaId !== reserva.id) {
        throw new ValidacaoError('Multa não encontrada nesta reserva.', {
          multaId: 'Escolha uma multa desta reserva.'
        });
      }
      return new SituacaoMulta(repos).saldo(multa);
    }
    const combinado = Dinheiro.deReais(
      tipo === 'ALUGUEL' ? reserva.valorTotal : reserva.valorCaucao
    );
    if (tipo === 'CAUCAO' && combinado.ehZero()) {
      throw new RegraNegocioError('Esta reserva não tem caução.');
    }
    const pago = Dinheiro.deReais(await repos.pagamentos.somarPorReserva(reserva.id, tipo));
    const falta = combinado.subtrair(pago);
    return falta.ehNegativo() ? Dinheiro.ZERO : falta;
  }

  static garantirNaoPassa(valor: Dinheiro, devido: Dinheiro): void {
    if (devido.ehZero()) throw new RegraNegocioError('Não há nada a pagar deste tipo.');
    if (!devido.maiorOuIgual(valor)) {
      throw new RegraNegocioError(`O valor passa do que falta pagar (${devido.formatar()}).`);
    }
  }

  static anotar(atuais: string | null, texto: string): string {
    return (atuais ? `${atuais} | ${texto}` : texto).slice(0, 255);
  }

  private async obter(id: number): Promise<Pagamento> {
    return PagamentoService.obterEm(this.dados.repos, id);
  }

  private static async obterEm(repos: Repositorios, id: number): Promise<Pagamento> {
    const pagamento = await repos.pagamentos.buscarPorId(id);
    if (!pagamento) throw new NaoEncontradoError('Pagamento', id);
    return pagamento;
  }
}
