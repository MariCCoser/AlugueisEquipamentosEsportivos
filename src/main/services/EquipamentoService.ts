import type {
  AlterarStatusEquipamentoDTO,
  AtualizarEquipamentoDTO,
  CriarEquipamentoDTO,
  EquipamentoDTO,
  FiltroEquipamentoDTO,
  ListarDisponiveisDTO
} from '@shared/dto/equipamento.dto';
import type { Paginado } from '@shared/dto/resposta';
import type { Categoria, Equipamento, Fornecedor } from '@shared/models/entidades';
import { EquipamentoDominio } from '../domain/EquipamentoDominio';
import { Periodo } from '../domain/Periodo';
import { NaoEncontradoError, RegraNegocioError, ValidacaoError } from '../errors/ErroApp';
import { TradutorErroBanco } from '../errors/TradutorErroBanco';
import type { CategoriaRepository } from '../repositories/CategoriaRepository';
import type { EquipamentoRepository } from '../repositories/EquipamentoRepository';
import type { FornecedorRepository } from '../repositories/FornecedorRepository';
import type { DisponibilidadeService } from './DisponibilidadeService';
import { EquipamentoMapper } from './mapeadores/EquipamentoMapper';
import { Paginador } from './Paginador';

export type RepoEquipamentos = Pick<
  EquipamentoRepository,
  'criar' | 'buscarPorId' | 'filtrar' | 'atualizar' | 'excluir' | 'atualizarStatus'
>;
export type RepoCategorias = Pick<CategoriaRepository, 'buscarPorId' | 'listar'>;
export type RepoFornecedores = Pick<FornecedorRepository, 'buscarPorId' | 'listarPorTipo'>;
export type ServicoDisponibilidade = Pick<DisponibilidadeService, 'filtrarDisponiveis'>;

/** Status que só mudam pelas regras do sistema, nunca à mão. */
const STATUS_AUTOMATICOS = new Set(['RESERVADO', 'EM_MANUTENCAO']);

/**
 * Regras do inventário.
 *
 * Listagem: o inventário de uma loja tem poucas centenas de itens, então os
 * filtros vão para o banco e a paginação é feita em memória (Paginador). Os
 * nomes de categoria/fornecedor vêm de duas consultas pequenas, em vez de uma
 * consulta por item.
 */
export class EquipamentoService {
  constructor(
    private readonly equipamentos: RepoEquipamentos,
    private readonly categorias: RepoCategorias,
    private readonly fornecedores: RepoFornecedores,
    private readonly disponibilidade: ServicoDisponibilidade
  ) {}

  async criar(dados: CriarEquipamentoDTO): Promise<EquipamentoDTO> {
    const novo = EquipamentoMapper.paraNovo(dados);
    EquipamentoDominio.validarPreco(novo.modalidade, novo.valorDiaria, novo.precoVenda);
    await this.garantirCategoria(novo.categoriaId);
    if (novo.fornecedorId != null) await this.garantirFornecedorDeCompra(novo.fornecedorId);

    const criado = await TradutorErroBanco.proteger(() => this.equipamentos.criar(novo), {
      referenciaInexistente: 'Categoria ou fornecedor não encontrado.'
    });
    return this.paraDTO(criado);
  }

  async listar(filtro: FiltroEquipamentoDTO = {}): Promise<Paginado<EquipamentoDTO>> {
    let encontrados = await this.equipamentos.filtrar({
      status: filtro.status,
      modalidade: filtro.modalidade,
      categoriaId: filtro.categoriaId,
      nome: filtro.busca
    });
    if (filtro.estadoConservacao) {
      encontrados = encontrados.filter((e) => e.estadoConservacao === filtro.estadoConservacao);
    }
    const pagina = Paginador.paginar(encontrados, filtro);
    return { ...pagina, itens: await this.paraDTOs(pagina.itens) };
  }

  async buscarPorId(id: number): Promise<EquipamentoDTO> {
    return this.paraDTO(await this.obter(id));
  }

  async atualizar({ id, ...dados }: AtualizarEquipamentoDTO): Promise<EquipamentoDTO> {
    const atual = await this.obter(id);
    const alteracoes = EquipamentoMapper.paraAtualizacao(dados);
    const final = { ...atual, ...alteracoes };

    EquipamentoDominio.validarPreco(final.modalidade, final.valorDiaria, final.precoVenda);
    if (alteracoes.modalidade && alteracoes.modalidade !== atual.modalidade) {
      if (atual.status === 'RESERVADO') {
        throw new RegraNegocioError('Não é possível mudar a modalidade de um item reservado.');
      }
    }
    if (alteracoes.categoriaId !== undefined) await this.garantirCategoria(final.categoriaId);
    if (alteracoes.fornecedorId != null) {
      await this.garantirFornecedorDeCompra(alteracoes.fornecedorId);
    }

    const atualizado = await TradutorErroBanco.proteger(
      () => this.equipamentos.atualizar(id, alteracoes),
      { referenciaInexistente: 'Categoria ou fornecedor não encontrado.' }
    );
    if (!atualizado) throw new NaoEncontradoError('Equipamento', id);
    return this.paraDTO(atualizado);
  }

  /**
   * Item que já foi alugado ou passou por manutenção não pode ser apagado
   * (o histórico precisa dele). Nesse caso a mensagem orienta a marcar como INDISPONIVEL.
   */
  async excluir(id: number): Promise<void> {
    await this.obter(id);
    await TradutorErroBanco.proteger(() => this.equipamentos.excluir(id), {
      emUso:
        'Não é possível excluir: o equipamento tem reservas ou manutenções no histórico. ' +
        'Marque-o como INDISPONIVEL.'
    });
  }

  /** Troca manual só entre DISPONIVEL e INDISPONIVEL. */
  async alterarStatus({ id, status }: AlterarStatusEquipamentoDTO): Promise<EquipamentoDTO> {
    if (status !== 'DISPONIVEL' && status !== 'INDISPONIVEL') {
      throw new ValidacaoError('Só é possível marcar como DISPONIVEL ou INDISPONIVEL.');
    }
    const atual = await this.obter(id);
    if (STATUS_AUTOMATICOS.has(atual.status)) {
      throw new RegraNegocioError(
        atual.status === 'RESERVADO'
          ? 'O equipamento está reservado: ele volta a ficar disponível na devolução.'
          : 'O equipamento está em manutenção: registre o retorno da manutenção.'
      );
    }
    if (atual.status !== status) await this.equipamentos.atualizarStatus(id, status);
    return this.paraDTO({ ...atual, status });
  }

  /** Itens de LOCACAO livres no período (assistente de nova reserva). */
  async listarDisponiveis(dados: ListarDisponiveisDTO): Promise<EquipamentoDTO[]> {
    const periodo = new Periodo(dados.dataRetirada, dados.dataDevolucaoPrevista);
    const candidatos = await this.equipamentos.filtrar({
      modalidade: 'LOCACAO',
      categoriaId: dados.categoriaId
    });
    const livres = await this.disponibilidade.filtrarDisponiveis(candidatos, periodo);
    return this.paraDTOs(livres);
  }

  // ---------- auxiliares ----------

  private async obter(id: number): Promise<Equipamento> {
    const equipamento = await this.equipamentos.buscarPorId(id);
    if (!equipamento) throw new NaoEncontradoError('Equipamento', id);
    return equipamento;
  }

  private async garantirCategoria(categoriaId: number): Promise<void> {
    if (!(await this.categorias.buscarPorId(categoriaId))) {
      throw new ValidacaoError('Categoria não encontrada.', {
        categoriaId: 'Escolha uma categoria existente.'
      });
    }
  }

  /** Regra que a FK não garante: o fornecedor do equipamento precisa ser de COMPRA. */
  private async garantirFornecedorDeCompra(fornecedorId: number): Promise<void> {
    const fornecedor = await this.fornecedores.buscarPorId(fornecedorId);
    if (!fornecedor) {
      throw new ValidacaoError('Fornecedor não encontrado.', {
        fornecedorId: 'Escolha um fornecedor existente.'
      });
    }
    if (fornecedor.tipo !== 'COMPRA') {
      throw new RegraNegocioError(
        `"${fornecedor.razaoSocial}" é prestador de manutenção, não fornecedor de compra.`
      );
    }
  }

  private async paraDTO(equipamento: Equipamento): Promise<EquipamentoDTO> {
    const [dto] = await this.paraDTOs([equipamento]);
    return dto!;
  }

  private async paraDTOs(equipamentos: Equipamento[]): Promise<EquipamentoDTO[]> {
    if (equipamentos.length === 0) return [];
    const [categorias, fornecedores] = await Promise.all([
      this.categorias.listar({ porPagina: Paginador.POR_PAGINA_MAXIMO }),
      this.fornecedores.listarPorTipo('COMPRA')
    ]);
    const porCategoria = new Map<number, Categoria>(categorias.map((c) => [c.id, c]));
    const porFornecedor = new Map<number, Fornecedor>(fornecedores.map((f) => [f.id, f]));
    return equipamentos.map((e) =>
      EquipamentoMapper.paraDTO(
        e,
        porCategoria.get(e.categoriaId),
        e.fornecedorId != null ? porFornecedor.get(e.fornecedorId) : undefined
      )
    );
  }
}
