import type { Paginado, DataISO } from '@shared/dto/resposta';
import type {
  AtualizarReservaDTO,
  CancelarReservaDTO,
  CriarReservaDTO,
  FiltroReservaDTO,
  ReservaAtrasadaDTO,
  ReservaDTO,
  ReservaResumoDTO
} from '@shared/dto/reserva.dto';
import type { Reserva } from '@shared/models/entidades';
import { Dinheiro } from '../../domain/Dinheiro';
import { EquipamentoDominio } from '../../domain/EquipamentoDominio';
import { Periodo } from '../../domain/Periodo';
import { ReservaDominio } from '../../domain/ReservaDominio';
import { NaoEncontradoError, RegraNegocioError } from '../../errors/DominioError';
import { EquipamentoIndisponivelError } from '../../errors/ReservaErrors';
import { TradutorErroBanco } from '../../errors/TradutorErroBanco';
import { ReservaMontador } from '../mapeadores/ReservaMontador';
import type { EstrategiaMulta } from '../multa/EstrategiaMulta';
import type { AcessoDados } from '../UnidadeDeTrabalho';
import { OperacoesReserva } from './OperacoesReserva';

/** Tamanho da coluna `observacoes`. */
const MAX_OBSERVACOES = 255;

/**
 * Ciclo de vida da reserva: criar, editar (só PENDENTE), confirmar retirada,
 * cancelar, excluir e as listagens. A devolução entra na etapa 4.
 *
 * Toda operação que muda mais de uma tabela roda em UMA transação.
 */
export class ReservaService {
  constructor(
    private readonly dados: AcessoDados,
    private readonly estrategiaMulta: EstrategiaMulta,
    /** Data de hoje (injetada para os testes poderem fixar o "hoje"). */
    private readonly hoje: () => DataISO
  ) {}

  /**
   * Cria a reserva e os itens juntos. A diária de cada item é copiada do
   * equipamento e o `usuarioId` vem da sessão — nada de preço ou usuário vindo da tela.
   */
  async criar(entrada: CriarReservaDTO, usuarioId: number): Promise<ReservaDTO> {
    const periodo = new Periodo(entrada.dataRetirada, entrada.dataDevolucaoPrevista);
    OperacoesReserva.garantirRetiradaNaoPassada(periodo, this.hoje());
    const ids = entrada.itens.map((i) => i.equipamentoId);
    OperacoesReserva.garantirSemRepetidos(ids);

    const id = await this.dados.transacao(async (repos) => {
      const ops = new OperacoesReserva(repos);
      const equipamentos = await ops.travarEquipamentos(ids); // 1º comando: trava
      await ops.garantirCliente(entrada.clienteId);
      await ops.garantirDisponiveis(equipamentos, periodo);

      const dominio = ReservaDominio.nova(
        periodo,
        OperacoesReserva.itensDeEquipamentos(equipamentos),
        Dinheiro.deReais(entrada.valorCaucao)
      );
      const reserva = await repos.reservas.criar({
        clienteId: entrada.clienteId,
        usuarioId,
        dataRetirada: periodo.retirada,
        dataDevolucaoPrevista: periodo.devolucaoPrevista,
        status: dominio.status,
        valorTotal: dominio.valorTotal().emReais(),
        valorCaucao: dominio.valorCaucao.emReais(),
        caucaoStatus: dominio.caucaoStatus,
        observacoes: entrada.observacoes ?? null
      });
      await ops.criarItens(reserva.id, equipamentos);
      return reserva.id;
    });
    return this.buscarPorId(id);
  }

  async listar(filtro: FiltroReservaDTO = {}): Promise<Paginado<ReservaResumoDTO>> {
    const { pagina, porPagina, ...criterios } = filtro;
    const resultado = await this.dados.repos.reservas.filtrar(criterios, { pagina, porPagina });
    return { ...resultado, itens: await this.montador().resumos(resultado.itens) };
  }

  async buscarPorId(id: number): Promise<ReservaDTO> {
    return this.montador().completa(await this.obter(id));
  }

  /** Só reserva PENDENTE. Mudando datas ou itens, a disponibilidade é conferida de novo. */
  async atualizar({ id, ...entrada }: AtualizarReservaDTO): Promise<ReservaDTO> {
    if (entrada.itens) {
      OperacoesReserva.garantirSemRepetidos(entrada.itens.map((i) => i.equipamentoId));
    }
    await this.dados.transacao(async (repos) => {
      const ops = new OperacoesReserva(repos);
      const reserva = await ops.travarReserva(id); // travas primeiro
      OperacoesReserva.garantirPendente(reserva, 'editar');

      const periodo = new Periodo(
        entrada.dataRetirada ?? reserva.dataRetirada,
        entrada.dataDevolucaoPrevista ?? reserva.dataDevolucaoPrevista
      );
      const mudouDatas =
        periodo.retirada !== reserva.dataRetirada ||
        periodo.devolucaoPrevista !== reserva.dataDevolucaoPrevista;
      if (mudouDatas) OperacoesReserva.garantirRetiradaNaoPassada(periodo, this.hoje());

      // Leitura COM trava: uma leitura comum aqui congelaria a foto antes de travar os equipamentos
      const itensAtuais = await repos.itensReserva.travarDaReserva(id);
      const ids =
        entrada.itens?.map((i) => i.equipamentoId) ?? itensAtuais.map((i) => i.equipamentoId);
      const equipamentos = await ops.travarEquipamentos(ids);

      if (entrada.clienteId !== undefined) await ops.garantirCliente(entrada.clienteId);
      if (mudouDatas || entrada.itens) await ops.garantirDisponiveis(equipamentos, periodo, id);

      const itens = entrada.itens
        ? OperacoesReserva.itensDeEquipamentos(equipamentos)
        : OperacoesReserva.itensGravados(itensAtuais);
      const dominio = ReservaDominio.nova(
        periodo,
        itens,
        Dinheiro.deReais(entrada.valorCaucao ?? reserva.valorCaucao)
      );

      if (entrada.itens) {
        await repos.itensReserva.excluirDaReserva(id);
        await ops.criarItens(id, equipamentos);
      }
      await repos.reservas.atualizar(id, {
        clienteId: entrada.clienteId,
        dataRetirada: periodo.retirada,
        dataDevolucaoPrevista: periodo.devolucaoPrevista,
        valorTotal: dominio.valorTotal().emReais(),
        valorCaucao: dominio.valorCaucao.emReais(),
        caucaoStatus: dominio.caucaoStatus,
        observacoes: entrada.observacoes
      });
    });
    return this.buscarPorId(id);
  }

  /** Só PENDENTE e sem pagamentos. No dia a dia, o caminho é cancelar. */
  async excluir(id: number): Promise<void> {
    await this.dados.transacao(async (repos) => {
      const reserva = await new OperacoesReserva(repos).travarReserva(id);
      OperacoesReserva.garantirPendente(reserva, 'excluir');
      if ((await repos.pagamentos.somarPorReserva(id)) > 0) {
        throw new RegraNegocioError('A reserva tem pagamentos: cancele em vez de excluir.');
      }
      await TradutorErroBanco.proteger(() => repos.reservas.excluir(id), {
        emUso: 'A reserva tem registros vinculados: cancele em vez de excluir.'
      });
    });
  }

  /**
   * Cliente levou os itens: PENDENTE → ATIVA e equipamentos → RESERVADO.
   * Confere de novo cada item (pode ter ido para manutenção ou ainda estar
   * com outro cliente atrasado) e registra o estado de conservação na saída.
   */
  async confirmarRetirada(id: number): Promise<ReservaDTO> {
    await this.dados.transacao(async (repos) => {
      const ops = new OperacoesReserva(repos);
      const reserva = await ops.travarReserva(id);
      const itens = await repos.itensReserva.travarDaReserva(id);
      const equipamentos = await ops.travarEquipamentos(itens.map((i) => i.equipamentoId));

      OperacoesReserva.dominioDe(reserva, itens).confirmarRetirada(); // valida PENDENTE → ATIVA
      for (const equipamento of equipamentos) {
        new EquipamentoDominio(equipamento).garantirReservavel();
        if (equipamento.status === 'RESERVADO') {
          throw new EquipamentoIndisponivelError(equipamento.nome, 'RESERVADO_NO_PERIODO');
        }
      }

      await repos.reservas.atualizarStatus(id, 'ATIVA');
      for (const item of itens) {
        const equipamento = equipamentos.find((e) => e.id === item.equipamentoId)!;
        await repos.equipamentos.atualizarStatus(equipamento.id, 'RESERVADO');
        await repos.itensReserva.atualizar(item.id, {
          estadoRetirada: equipamento.estadoConservacao
        });
      }
    });
    return this.buscarPorId(id);
  }

  /** PENDENTE/ATIVA → CANCELADA. Se já tinha saído (ATIVA), os itens voltam a DISPONIVEL. */
  async cancelar({ id, motivo }: CancelarReservaDTO): Promise<ReservaDTO> {
    await this.dados.transacao(async (repos) => {
      const ops = new OperacoesReserva(repos);
      const reserva = await ops.travarReserva(id);
      const itens = await repos.itensReserva.travarDaReserva(id);
      const equipamentos =
        reserva.status === 'ATIVA'
          ? await ops.travarEquipamentos(itens.map((i) => i.equipamentoId))
          : [];

      OperacoesReserva.dominioDe(reserva, itens).cancelar(); // valida a transição

      for (const equipamento of equipamentos) {
        if (equipamento.status === 'RESERVADO') {
          await repos.equipamentos.atualizarStatus(equipamento.id, 'DISPONIVEL');
        }
      }
      await repos.reservas.atualizar(id, {
        status: 'CANCELADA',
        observacoes: ReservaService.observacoesComMotivo(reserva.observacoes, motivo)
      });
    });
    return this.buscarPorId(id);
  }

  /** Painel de devoluções: tudo que está com cliente agora. */
  async listarAtivas(): Promise<ReservaResumoDTO[]> {
    return this.montador().resumos(await this.dados.repos.reservas.listarPorStatus('ATIVA'));
  }

  /** ATIVAS com prazo vencido, com dias de atraso e a multa se devolvesse hoje. */
  async listarAtrasadas(): Promise<ReservaAtrasadaDTO[]> {
    const hoje = this.hoje();
    const reservas = await this.dados.repos.reservas.listarAtrasadas(hoje);
    const resumos = await this.montador().resumos(reservas);
    const resultado: ReservaAtrasadaDTO[] = [];
    for (const [i, reserva] of reservas.entries()) {
      const itens = await this.dados.repos.itensReserva.listarPorReserva(reserva.id);
      const dominio = OperacoesReserva.dominioDe(reserva, itens);
      const diasAtraso = dominio.periodo.diasAtraso(hoje);
      const multa = this.estrategiaMulta.calcular({
        diasAtraso,
        somaDiarias: dominio.somaDiarias()
      });
      resultado.push({ ...resumos[i]!, diasAtraso, multaPrevista: multa.emReais() });
    }
    return resultado;
  }

  // ---------- auxiliares ----------

  private async obter(id: number): Promise<Reserva> {
    const reserva = await this.dados.repos.reservas.buscarPorId(id);
    if (!reserva) throw new NaoEncontradoError('Reserva', id);
    return reserva;
  }

  private montador(): ReservaMontador {
    return new ReservaMontador(this.dados.repos);
  }

  /** Junta o motivo do cancelamento às observações, sem passar do tamanho da coluna. */
  static observacoesComMotivo(atuais: string | null, motivo?: string): string | null {
    const texto = motivo?.trim();
    if (!texto) return atuais;
    const junto = atuais ? `${atuais} | Cancelada: ${texto}` : `Cancelada: ${texto}`;
    return junto.slice(0, MAX_OBSERVACOES);
  }
}
