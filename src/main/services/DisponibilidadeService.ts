import type { DisponibilidadeDTO, VerificarDisponibilidadeDTO } from '@shared/dto/equipamento.dto';
import type { Equipamento } from '@shared/models/entidades';
import { EquipamentoDominio } from '../domain/EquipamentoDominio';
import { Periodo } from '../domain/Periodo';
import { NaoEncontradoError } from '../errors/ErroApp';
import type { MotivoIndisponivel } from '../errors/ReservaErrors';
import type { EquipamentoRepository } from '../repositories/EquipamentoRepository';
import type { ManutencaoRepository } from '../repositories/ManutencaoRepository';
import type { ReservaRepository } from '../repositories/ReservaRepository';

export type RepoEquipamentosDisp = Pick<EquipamentoRepository, 'buscarPorId'>;
export type RepoManutencoesDisp = Pick<ManutencaoRepository, 'buscarEmAbertoDoEquipamento'>;
export type RepoReservasDisp = Pick<ReservaRepository, 'equipamentoReservadoNoPeriodo'>;

/**
 * Responde "este equipamento pode ser alugado neste período?".
 *
 * A checagem vai da mais barata para a mais cara e para no primeiro impedimento:
 * 1. o próprio cadastro (só VENDA, INDISPONIVEL, EM_MANUTENCAO) — sem consultar o banco;
 * 2. manutenção em aberto (pega também status desatualizado);
 * 3. outra reserva PENDENTE/ATIVA que cruza o período (bordas inclusivas).
 *
 * Usado pela tela (verificar/listar disponíveis) e pelo ReservaService ao criar
 * ou editar uma reserva — lá, dentro da transação.
 */
export class DisponibilidadeService {
  constructor(
    private readonly equipamentos: RepoEquipamentosDisp,
    private readonly manutencoes: RepoManutencoesDisp,
    private readonly reservas: RepoReservasDisp
  ) {}

  async verificar(dados: VerificarDisponibilidadeDTO): Promise<DisponibilidadeDTO> {
    const equipamento = await this.equipamentos.buscarPorId(dados.equipamentoId);
    if (!equipamento) throw new NaoEncontradoError('Equipamento', dados.equipamentoId);
    const periodo = new Periodo(dados.dataRetirada, dados.dataDevolucaoPrevista);
    const motivo = await this.motivoIndisponibilidade(equipamento, periodo, dados.ignorarReservaId);
    return motivo ? { disponivel: false, motivo } : { disponivel: true };
  }

  /** Mantém só os equipamentos livres no período (ordem preservada). */
  async filtrarDisponiveis(equipamentos: Equipamento[], periodo: Periodo): Promise<Equipamento[]> {
    const livres: Equipamento[] = [];
    for (const equipamento of equipamentos) {
      if ((await this.motivoIndisponibilidade(equipamento, periodo)) === null) {
        livres.push(equipamento);
      }
    }
    return livres;
  }

  /** `null` = livre; senão, o primeiro motivo encontrado. */
  async motivoIndisponibilidade(
    equipamento: Equipamento,
    periodo: Periodo,
    ignorarReservaId?: number
  ): Promise<MotivoIndisponivel | null> {
    const impedimento = new EquipamentoDominio(equipamento).impedimentoParaReserva();
    if (impedimento) return impedimento;

    if (await this.manutencoes.buscarEmAbertoDoEquipamento(equipamento.id)) {
      return 'EM_MANUTENCAO';
    }

    const ocupado = await this.reservas.equipamentoReservadoNoPeriodo(
      equipamento.id,
      periodo.retirada,
      periodo.devolucaoPrevista,
      ignorarReservaId
    );
    return ocupado ? 'RESERVADO_NO_PERIODO' : null;
  }
}
