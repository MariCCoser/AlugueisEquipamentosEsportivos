import type { Paginado } from '@shared/dto/resposta';
import type { Registro } from '@shared/models/entidades';
import type { Executor, ParametroSql } from '../database/Database';

/** Uma linha crua como o mysql2 devolve (colunas em snake_case). */
export type Linha = Record<string, unknown>;

export type Direcao = 'ASC' | 'DESC';

export interface OpcoesListagem<E> {
  /** Começa em 1. Padrão: 1. */
  pagina?: number;
  /** Máximo de itens por página (1 a 100). Padrão: 20. */
  porPagina?: number;
  /** Campo da entidade (camelCase). Só aceita campos conhecidos do repositório. */
  ordenarPor?: keyof E & string;
  direcao?: Direcao;
}

/**
 * Lista os campos gravados (INSERT/UPDATE) de um repositório. É um objeto (e não um array)
 * para o TypeScript acusar erro se algum campo do tipo `Novo...` ficar de fora.
 */
export type CamposGravaveis<N> = { readonly [K in keyof Required<N>]: true };

export const POR_PAGINA_PADRAO = 20;
export const POR_PAGINA_MAXIMO = 100;

/** Só nomes simples (letras minúsculas, números e _) podem entrar na SQL como tabela/coluna. */
const NOME_SQL_SEGURO = /^[a-z][a-z0-9_]*$/;

export class RepositorioError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'RepositorioError';
  }
}

/** `categoriaId` -> `categoria_id` */
export function paraSnake(campo: string): string {
  return campo.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`);
}

/** `categoria_id` -> `categoriaId` */
export function paraCamel(coluna: string): string {
  return coluna.replace(/_([a-z0-9])/g, (_, letra: string) => letra.toUpperCase());
}

/** Escapa `%`, `_` e `\` para o texto do usuário ser procurado literalmente num LIKE. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caractere) => `\\${caractere}`);
}

/**
 * Base de todos os repositórios: CRUD genérico de uma tabela.
 *
 * Segurança:
 * - Valores SEMPRE vão nos parâmetros (`?`), nunca concatenados.
 * - Nomes de tabela/coluna não podem ser `?`, então só entram os definidos pela própria
 *   subclasse (`tabela` e `campos`) — nunca uma chave vinda do Renderer. Campos
 *   desconhecidos em `criar`/`atualizar` são ignorados.
 *
 * Transações: o repositório recebe um `Executor`, que pode ser o `Database` (pool) ou a
 * conexão de `db.transacao(tx => ...)`. Para gravar em transação, crie o repositório com o
 * `tx` (veja `criarRepositorios` em `index.ts`).
 *
 * @typeParam E entidade devolvida (ex.: `Cliente`)
 * @typeParam N dados de criação (ex.: `NovoCliente`); `atualizar` aceita `Partial<N>`
 */
export abstract class BaseRepository<E extends Registro, N extends object> {
  /** Nome da tabela no banco. */
  protected abstract readonly tabela: string;
  /** Campos que podem ser gravados. O nome da coluna é o campo em snake_case. */
  protected abstract readonly campos: CamposGravaveis<N>;
  /** Campos TINYINT(1) que devem virar boolean. */
  protected readonly camposBooleanos: readonly (keyof E & string)[] = [];

  constructor(protected readonly db: Executor) {}

  async criar(dados: N): Promise<E> {
    const presentes = this.camposPresentes(dados);
    if (presentes.length === 0) {
      throw new RepositorioError(`Nenhum campo informado para criar em ${this.tabela}.`);
    }
    const colunas = presentes.map((campo) => this.coluna(campo)).join(', ');
    const marcadores = presentes.map(() => '?').join(', ');
    const { idInserido } = await this.db.executar(
      `INSERT INTO ${this.nomeTabela()} (${colunas}) VALUES (${marcadores})`,
      this.valores(dados, presentes)
    );
    const criado = await this.buscarPorId(idInserido);
    if (!criado) {
      throw new RepositorioError(
        `Registro ${idInserido} não encontrado após criar em ${this.tabela}.`
      );
    }
    return criado;
  }

  async buscarPorId(id: number): Promise<E | null> {
    return this.buscarUm('id = ?', [id]);
  }

  async listar(opcoes: OpcoesListagem<E> = {}): Promise<E[]> {
    const { limite, deslocamento } = this.paginacao(opcoes);
    return this.selecionar('', [], `${this.ordenacao(opcoes)} LIMIT ? OFFSET ?`, [
      limite,
      deslocamento
    ]);
  }

  async listarPaginado(opcoes: OpcoesListagem<E> = {}): Promise<Paginado<E>> {
    const { pagina, limite } = this.paginacao(opcoes);
    const [itens, total] = await Promise.all([this.listar(opcoes), this.contar()]);
    return { itens, total, pagina, porPagina: limite };
  }

  async contar(): Promise<number> {
    return this.contarOnde('', []);
  }

  /**
   * Atualiza só os campos informados (`undefined` = não mexe; `null` = grava NULL).
   * Devolve o registro atualizado, ou `null` se o id não existir.
   */
  async atualizar(id: number, dados: Partial<N>): Promise<E | null> {
    const presentes = this.camposPresentes(dados);
    if (presentes.length > 0) {
      const atribuicoes = presentes.map((campo) => `${this.coluna(campo)} = ?`).join(', ');
      await this.db.executar(`UPDATE ${this.nomeTabela()} SET ${atribuicoes} WHERE id = ?`, [
        ...this.valores(dados, presentes),
        id
      ]);
    }
    return this.buscarPorId(id);
  }

  /** Devolve `true` se apagou. Lança o erro do MySQL se outra tabela depender do registro (FK). */
  async excluir(id: number): Promise<boolean> {
    const { linhasAfetadas } = await this.db.executar(
      `DELETE FROM ${this.nomeTabela()} WHERE id = ?`,
      [id]
    );
    return linhasAfetadas > 0;
  }

  // ---------- ajudantes para as subclasses ----------

  /**
   * SELECT * da tabela com um WHERE opcional.
   * @param condicao trecho fixo escrito na subclasse, com `?` para os valores (ex.: 'cpf = ?')
   * @param sufixo ORDER BY / LIMIT; padrão: ORDER BY id
   */
  protected async selecionar(
    condicao: string,
    params: ParametroSql[],
    sufixo = 'ORDER BY id',
    paramsSufixo: ParametroSql[] = []
  ): Promise<E[]> {
    const onde = condicao ? ` WHERE ${condicao}` : '';
    const linhas = await this.db.consultar<Linha>(
      `SELECT * FROM ${this.nomeTabela()}${onde} ${sufixo}`.trim(),
      [...params, ...paramsSufixo]
    );
    return linhas.map((linha) => this.paraEntidade(linha));
  }

  protected async buscarUm(condicao: string, params: ParametroSql[]): Promise<E | null> {
    const [primeiro] = await this.selecionar(condicao, params, 'LIMIT 1');
    return primeiro ?? null;
  }

  protected async contarOnde(condicao: string, params: ParametroSql[]): Promise<number> {
    const onde = condicao ? ` WHERE ${condicao}` : '';
    const [linha] = await this.db.consultar<{ total: number | string }>(
      `SELECT COUNT(*) AS total FROM ${this.nomeTabela()}${onde}`,
      params
    );
    return Number(linha?.total ?? 0);
  }

  /** Converte a linha do banco (snake_case) para a entidade (camelCase). */
  protected paraEntidade(linha: Linha): E {
    const entidade: Record<string, unknown> = {};
    for (const [coluna, valor] of Object.entries(linha)) {
      entidade[paraCamel(coluna)] = valor;
    }
    for (const campo of this.camposBooleanos) {
      const valor = entidade[campo];
      if (valor !== null && valor !== undefined) entidade[campo] = Number(valor) === 1;
    }
    return entidade as E;
  }

  /** Nome da coluna de um campo conhecido, já validado. */
  protected coluna(campo: string): string {
    const coluna = paraSnake(campo);
    if (!NOME_SQL_SEGURO.test(coluna)) {
      throw new RepositorioError(`Nome de coluna inválido: ${campo}`);
    }
    return coluna;
  }

  protected nomeTabela(): string {
    if (!NOME_SQL_SEGURO.test(this.tabela)) {
      throw new RepositorioError(`Nome de tabela inválido: ${this.tabela}`);
    }
    return this.tabela;
  }

  // ---------- internos ----------

  private camposPresentes(dados: Partial<N>): (keyof N & string)[] {
    const conhecidos = Object.keys(this.campos) as (keyof N & string)[];
    return conhecidos.filter((campo) => dados[campo] !== undefined);
  }

  private valores(dados: Partial<N>, campos: (keyof N & string)[]): ParametroSql[] {
    return campos.map((campo) => dados[campo] as ParametroSql);
  }

  private paginacao(opcoes: OpcoesListagem<E>): {
    pagina: number;
    limite: number;
    deslocamento: number;
  } {
    const pagina = Math.max(1, Math.floor(opcoes.pagina ?? 1) || 1);
    const pedido = Math.floor(opcoes.porPagina ?? POR_PAGINA_PADRAO) || POR_PAGINA_PADRAO;
    const limite = Math.min(POR_PAGINA_MAXIMO, Math.max(1, pedido));
    return { pagina, limite, deslocamento: (pagina - 1) * limite };
  }

  private ordenacao(opcoes: OpcoesListagem<E>): string {
    const campo = opcoes.ordenarPor ?? 'id';
    const permitidos = new Set<string>([
      'id',
      'createdAt',
      'updatedAt',
      ...Object.keys(this.campos)
    ]);
    if (!permitidos.has(campo)) {
      throw new RepositorioError(`Não é possível ordenar ${this.tabela} por "${campo}".`);
    }
    const direcao = opcoes.direcao === 'DESC' ? 'DESC' : 'ASC';
    // desempate por id para a paginação ficar estável
    return campo === 'id'
      ? `ORDER BY id ${direcao}`
      : `ORDER BY ${this.coluna(campo)} ${direcao}, id ${direcao}`;
  }
}
