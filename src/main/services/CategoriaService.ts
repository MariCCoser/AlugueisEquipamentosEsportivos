import type {
  AtualizarCategoriaDTO,
  CategoriaDTO,
  CriarCategoriaDTO
} from '@shared/dto/categoria.dto';
import type { Categoria, NovaCategoria } from '@shared/models/entidades';
import type { CategoriaRepository } from '../repositories/CategoriaRepository';
import { NaoEncontradoError, RegraNegocioError } from '../errors/ErroApp';
import { TradutorErroBanco } from '../errors/TradutorErroBanco';

/** Só o que o service usa do repositório (facilita testar com um objeto falso). */
export type RepoCategorias = Pick<
  CategoriaRepository,
  | 'criar'
  | 'buscarPorId'
  | 'buscarPorNome'
  | 'listarComUso'
  | 'atualizar'
  | 'excluir'
  | 'contarEquipamentos'
>;

const MSG_NOME_DUPLICADO = 'Já existe uma categoria com esse nome.';

/**
 * Regras do cadastro de categorias (Pessoa 4).
 * O formato dos campos é validado antes, pelo categoria.schema.ts na camada de IPC;
 * aqui ficam as regras que dependem do banco.
 */
export class CategoriaService {
  constructor(private readonly categorias: RepoCategorias) {}

  async listar(): Promise<CategoriaDTO[]> {
    const lista = await this.categorias.listarComUso();
    return lista.map((c) => CategoriaService.paraDTO(c, c.qtdEquipamentos));
  }

  async buscarPorId(id: number): Promise<CategoriaDTO> {
    return this.comUso(await this.obter(id));
  }

  async criar(dados: CriarCategoriaDTO): Promise<CategoriaDTO> {
    await this.garantirNomeLivre(dados.nome);
    const nova: NovaCategoria = {
      nome: dados.nome,
      descricao: dados.descricao ?? null,
      sensivelClima: dados.sensivelClima ?? false
    };
    const criada = await TradutorErroBanco.proteger(() => this.categorias.criar(nova), {
      duplicado: MSG_NOME_DUPLICADO
    });
    return CategoriaService.paraDTO(criada, 0);
  }

  async atualizar({ id, ...dados }: AtualizarCategoriaDTO): Promise<CategoriaDTO> {
    await this.obter(id);
    if (dados.nome !== undefined) await this.garantirNomeLivre(dados.nome, id);

    const alteracoes: Partial<NovaCategoria> = {
      nome: dados.nome,
      sensivelClima: dados.sensivelClima,
      // Descrição enviada vazia = apagar a descrição; não enviada = manter.
      descricao: 'descricao' in dados ? (dados.descricao ?? null) : undefined
    };
    const atualizada = await TradutorErroBanco.proteger(
      () => this.categorias.atualizar(id, alteracoes),
      { duplicado: MSG_NOME_DUPLICADO }
    );
    if (!atualizada) throw new NaoEncontradoError('Categoria', id);
    return this.comUso(atualizada);
  }

  /**
   * Categoria com equipamentos não pode ser excluída. A FK do banco já impediria,
   * mas checar antes permite uma mensagem clara dizendo quantos equipamentos usam.
   */
  async excluir(id: number): Promise<void> {
    const categoria = await this.obter(id);
    const emUso = await this.categorias.contarEquipamentos(id);
    if (emUso > 0) {
      throw new RegraNegocioError(
        `Não é possível excluir "${categoria.nome}": ${emUso} equipamento(s) usam esta categoria.`
      );
    }
    await TradutorErroBanco.proteger(() => this.categorias.excluir(id), {
      emUso: 'Não é possível excluir: existem equipamentos nesta categoria.'
    });
  }

  private async obter(id: number): Promise<Categoria> {
    const categoria = await this.categorias.buscarPorId(id);
    if (!categoria) throw new NaoEncontradoError('Categoria', id);
    return categoria;
  }

  private async comUso(categoria: Categoria): Promise<CategoriaDTO> {
    return CategoriaService.paraDTO(
      categoria,
      await this.categorias.contarEquipamentos(categoria.id)
    );
  }

  /**
   * Mensagem amigável antes do UNIQUE do banco (que continua garantindo no fim).
   * A collation do MySQL (utf8mb4_unicode_ci) compara sem diferenciar maiúsculas
   * e acentos, então "caiaque" e "Caiaque" contam como o mesmo nome.
   */
  private async garantirNomeLivre(nome: string, idAtual?: number): Promise<void> {
    const existente = await this.categorias.buscarPorNome(nome);
    if (existente && existente.id !== idAtual) throw new RegraNegocioError(MSG_NOME_DUPLICADO);
  }

  private static paraDTO(categoria: Categoria, qtdEquipamentos: number): CategoriaDTO {
    return {
      id: categoria.id,
      nome: categoria.nome,
      descricao: categoria.descricao ?? undefined,
      sensivelClima: categoria.sensivelClima,
      qtdEquipamentos
    };
  }
}
