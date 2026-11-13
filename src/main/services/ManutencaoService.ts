import type {
  AtualizarManutencaoDTO,
  CriarManutencaoDTO,
  EquipamentoIdDTO,
  FiltroManutencaoDTO,
  ManutencaoDTO,
  RegistrarRetornoDTO
} from '@shared/dto/manutencao.dto';
import type { DataISO } from '@shared/dto/resposta';
import type { Manutencao } from '@shared/models/entidades';
import { CalendarioISO } from '../domain/CalendarioISO';
import { NaoEncontradoError, RegraNegocioError, ValidacaoError } from '../errors/ErroApp';
import { OperacoesReserva } from './reserva/OperacoesReserva';
import type { AcessoDados } from './UnidadeDeTrabalho';

/**
 * Envio de equipamentos para conserto e retorno.
 * Regras que a FK não garante:
 * - o prestador precisa ser fornecedor do tipo MANUTENCAO;
 * - item com cliente (RESERVADO) ou já em manutenção não pode ser enviado;
 * - envio → equipamento EM_MANUTENCAO; retorno → DISPONIVEL e com o novo estado de conservação.
 */
export class ManutencaoService {
  constructor(
    private readonly dados: AcessoDados,
    private readonly hoje: () => DataISO
  ) {}

  async criar(entrada: CriarManutencaoDTO): Promise<ManutencaoDTO> {
    this.garantirNaoFutura(entrada.dataEnvio, 'dataEnvio', 'envio');
    const id = await this.dados.transacao(async (repos) => {
      const [equipamento] = await new OperacoesReserva(repos).travarEquipamentos([
        entrada.equipamentoId
      ]);
      const fornecedor = await repos.fornecedores.buscarPorId(entrada.fornecedorId);
      if (!fornecedor) {
        throw new ValidacaoError('Prestador não encontrado.', {
          fornecedorId: 'Escolha um prestador de manutenção.'
        });
      }
      if (fornecedor.tipo !== 'MANUTENCAO') {
        throw new RegraNegocioError(
          `"${fornecedor.razaoSocial}" é fornecedor de compra, não prestador de manutenção.`
        );
      }
      if (equipamento!.status === 'RESERVADO') {
        throw new RegraNegocioError(
          `"${equipamento!.nome}" está com um cliente. Registre a devolução antes.`
        );
      }
      if (await repos.manutencoes.buscarEmAbertoDoEquipamento(equipamento!.id)) {
        throw new RegraNegocioError(`"${equipamento!.nome}" já está em manutenção.`);
      }
      const manutencao = await repos.manutencoes.criar({
        equipamentoId: equipamento!.id,
        fornecedorId: fornecedor.id,
        tipo: entrada.tipo,
        descricao: entrada.descricao,
        dataEnvio: entrada.dataEnvio
      });
      await repos.equipamentos.atualizarStatus(equipamento!.id, 'EM_MANUTENCAO');
      return manutencao.id;
    });
    return this.buscarPorId(id);
  }

  async listar(filtro: FiltroManutencaoDTO = {}): Promise<ManutencaoDTO[]> {
    return this.paraDTOs(await this.dados.repos.manutencoes.filtrar(filtro));
  }

  async listarAbertas(): Promise<ManutencaoDTO[]> {
    return this.paraDTOs(await this.dados.repos.manutencoes.listarEmAberto());
  }

  async listarPorEquipamento({ equipamentoId }: EquipamentoIdDTO): Promise<ManutencaoDTO[]> {
    if (!(await this.dados.repos.equipamentos.buscarPorId(equipamentoId))) {
      throw new NaoEncontradoError('Equipamento', equipamentoId);
    }
    return this.paraDTOs(await this.dados.repos.manutencoes.listarPorEquipamento(equipamentoId));
  }

  async buscarPorId(id: number): Promise<ManutencaoDTO> {
    const [dto] = await this.paraDTOs([await this.obter(id)]);
    return dto!;
  }

  /** Correção (ADMIN): tipo, descrição, data de envio e custo. */
  async atualizar({ id, ...entrada }: AtualizarManutencaoDTO): Promise<ManutencaoDTO> {
    const atual = await this.obter(id);
    if (entrada.dataEnvio !== undefined) {
      this.garantirNaoFutura(entrada.dataEnvio, 'dataEnvio', 'envio');
      if (atual.dataRetorno && CalendarioISO.diasEntre(entrada.dataEnvio, atual.dataRetorno) < 0) {
        throw new ValidacaoError('O envio não pode ser depois do retorno.', {
          dataEnvio: `O retorno foi em ${atual.dataRetorno}.`
        });
      }
    }
    await this.dados.repos.manutencoes.atualizar(id, entrada);
    return this.buscarPorId(id);
  }

  /** Volta do conserto: grava data, custo e estado; o equipamento fica DISPONIVEL. */
  async registrarRetorno(entrada: RegistrarRetornoDTO): Promise<ManutencaoDTO> {
    this.garantirNaoFutura(entrada.dataRetorno, 'dataRetorno', 'retorno');
    const { equipamentoId } = await this.obter(entrada.id);
    await this.dados.transacao(async (repos) => {
      const [equipamento] = await new OperacoesReserva(repos).travarEquipamentos([equipamentoId]);
      const manutencao = await repos.manutencoes.buscarPorId(entrada.id);
      if (!manutencao) throw new NaoEncontradoError('Manutenção', entrada.id);
      if (manutencao.dataRetorno) {
        throw new RegraNegocioError('O retorno desta manutenção já foi registrado.');
      }
      if (CalendarioISO.diasEntre(manutencao.dataEnvio, entrada.dataRetorno) < 0) {
        throw new ValidacaoError('O retorno não pode ser antes do envio.', {
          dataRetorno: `O envio foi em ${manutencao.dataEnvio}.`
        });
      }
      await repos.manutencoes.registrarRetorno(entrada.id, {
        dataRetorno: entrada.dataRetorno,
        custo: entrada.custo ?? null,
        estadoRetorno: entrada.estadoRetorno
      });
      await repos.equipamentos.atualizar(equipamentoId, {
        estadoConservacao: entrada.estadoRetorno
      });
      if (equipamento!.status === 'EM_MANUTENCAO') {
        await repos.equipamentos.atualizarStatus(equipamentoId, 'DISPONIVEL');
      }
    });
    return this.buscarPorId(entrada.id);
  }

  /** Registro lançado por engano (ADMIN). Se estava em aberto, o item volta a DISPONIVEL. */
  async excluir(id: number): Promise<void> {
    const { equipamentoId } = await this.obter(id);
    await this.dados.transacao(async (repos) => {
      const [equipamento] = await new OperacoesReserva(repos).travarEquipamentos([equipamentoId]);
      const manutencao = await repos.manutencoes.buscarPorId(id);
      if (!manutencao) throw new NaoEncontradoError('Manutenção', id);
      await repos.manutencoes.excluir(id);
      if (!manutencao.dataRetorno && equipamento!.status === 'EM_MANUTENCAO') {
        await repos.equipamentos.atualizarStatus(equipamentoId, 'DISPONIVEL');
      }
    });
  }

  // ---------- auxiliares ----------

  private garantirNaoFutura(data: DataISO, campo: string, nome: string): void {
    if (CalendarioISO.diasEntre(this.hoje(), data) > 0) {
      throw new ValidacaoError(`A data de ${nome} não pode estar no futuro.`, {
        [campo]: 'Use hoje ou uma data passada.'
      });
    }
  }

  private async obter(id: number): Promise<Manutencao> {
    const manutencao = await this.dados.repos.manutencoes.buscarPorId(id);
    if (!manutencao) throw new NaoEncontradoError('Manutenção', id);
    return manutencao;
  }

  /** Nomes de equipamento e prestador: duas consultas para a lista inteira. */
  private async paraDTOs(manutencoes: Manutencao[]): Promise<ManutencaoDTO[]> {
    if (manutencoes.length === 0) return [];
    const [equipamentos, prestadores] = await Promise.all([
      this.dados.repos.equipamentos.buscarPorIds(manutencoes.map((m) => m.equipamentoId)),
      this.dados.repos.fornecedores.listarPorTipo('MANUTENCAO')
    ]);
    const nomeEquip = new Map(equipamentos.map((e) => [e.id, e.nome]));
    const nomePrest = new Map(prestadores.map((f) => [f.id, f.razaoSocial]));
    return manutencoes.map((m) => {
      const dto: ManutencaoDTO = {
        id: m.id,
        equipamentoId: m.equipamentoId,
        equipamentoNome: nomeEquip.get(m.equipamentoId) ?? '',
        fornecedorId: m.fornecedorId,
        fornecedorNome: nomePrest.get(m.fornecedorId) ?? '',
        tipo: m.tipo,
        descricao: m.descricao,
        dataEnvio: m.dataEnvio
      };
      if (m.dataRetorno) dto.dataRetorno = m.dataRetorno;
      if (m.custo != null) dto.custo = m.custo;
      if (m.estadoRetorno) dto.estadoRetorno = m.estadoRetorno;
      return dto;
    });
  }
}
