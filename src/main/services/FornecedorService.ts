import type {
  AtualizarFornecedorDTO,
  CriarFornecedorDTO,
  FiltroFornecedorDTO,
  FornecedorDTO
} from '@shared/dto/fornecedor.dto';
import type { Fornecedor, NovoFornecedor } from '@shared/models/entidades';
import type { TipoFornecedor } from '@shared/models/enums';
import type {
  FornecedorRepository,
  VinculosFornecedor
} from '../repositories/FornecedorRepository';
import { NaoEncontradoError, RegraNegocioError } from '../errors/ErroApp';
import { TradutorErroBanco } from '../errors/TradutorErroBanco';

/** Só o que o service usa do repositório (facilita testar com um objeto falso). */
export type RepoFornecedoresCadastro = Pick<
  FornecedorRepository,
  | 'criar'
  | 'buscarPorId'
  | 'buscarPorCnpj'
  | 'listarFiltrado'
  | 'listarPorTipo'
  | 'atualizar'
  | 'excluir'
  | 'contarVinculos'
>;

const MSG_CNPJ_DUPLICADO = 'Já existe um fornecedor cadastrado com este CNPJ.';

/**
 * Regras do cadastro de fornecedores (Pessoa 4).
 * O formato (CNPJ com dígitos verificadores, e-mail, telefone) é validado antes,
 * pelo fornecedor.schema.ts; aqui ficam as regras que dependem do banco.
 */
export class FornecedorService {
  constructor(private readonly fornecedores: RepoFornecedoresCadastro) {}

  async listar(filtro: FiltroFornecedorDTO = {}): Promise<FornecedorDTO[]> {
    const lista = await this.fornecedores.listarFiltrado(filtro);
    return lista.map((f) => FornecedorService.paraDTO(f));
  }

  /** Usado nas abas da tela e nos selects (ex.: prestadores de MANUTENCAO). */
  async listarPorTipo(tipo: TipoFornecedor): Promise<FornecedorDTO[]> {
    const lista = await this.fornecedores.listarPorTipo(tipo);
    return lista.map((f) => FornecedorService.paraDTO(f));
  }

  async buscarPorId(id: number): Promise<FornecedorDTO> {
    return FornecedorService.paraDTO(await this.obter(id));
  }

  async criar(dados: CriarFornecedorDTO): Promise<FornecedorDTO> {
    await this.garantirCnpjLivre(dados.cnpj);
    const novo: NovoFornecedor = {
      razaoSocial: dados.razaoSocial,
      cnpj: dados.cnpj,
      tipo: dados.tipo,
      contato: dados.contato ?? null,
      telefone: dados.telefone ?? null,
      email: dados.email ?? null
    };
    const criado = await TradutorErroBanco.proteger(() => this.fornecedores.criar(novo), {
      duplicado: MSG_CNPJ_DUPLICADO
    });
    return FornecedorService.paraDTO(criado);
  }

  async atualizar({ id, ...dados }: AtualizarFornecedorDTO): Promise<FornecedorDTO> {
    const atual = await this.obter(id);
    if (dados.cnpj !== undefined) await this.garantirCnpjLivre(dados.cnpj, id);

    // Mudar o tipo quebraria a regra da Pessoa 2: equipamento vem de fornecedor de
    // COMPRA e manutenção é feita por prestador de MANUTENCAO.
    if (dados.tipo !== undefined && dados.tipo !== atual.tipo) {
      const vinculos = await this.fornecedores.contarVinculos(id);
      if (FornecedorService.total(vinculos) > 0) {
        throw new RegraNegocioError(
          `Não é possível mudar o tipo: o fornecedor já tem ${FornecedorService.descrever(vinculos)}.`
        );
      }
    }

    const alteracoes: Partial<NovoFornecedor> = {
      razaoSocial: dados.razaoSocial,
      cnpj: dados.cnpj,
      tipo: dados.tipo,
      // Opcional enviado vazio = apagar; não enviado = manter.
      contato: FornecedorService.opcional(dados, 'contato'),
      telefone: FornecedorService.opcional(dados, 'telefone'),
      email: FornecedorService.opcional(dados, 'email')
    };
    const atualizado = await TradutorErroBanco.proteger(
      () => this.fornecedores.atualizar(id, alteracoes),
      { duplicado: MSG_CNPJ_DUPLICADO }
    );
    if (!atualizado) throw new NaoEncontradoError('Fornecedor', id);
    return FornecedorService.paraDTO(atualizado);
  }

  /**
   * Fornecedor com equipamentos ou manutenções não pode ser excluído: o histórico
   * de compras e consertos precisa continuar apontando para ele.
   */
  async excluir(id: number): Promise<void> {
    const fornecedor = await this.obter(id);
    const vinculos = await this.fornecedores.contarVinculos(id);
    if (FornecedorService.total(vinculos) > 0) {
      throw new RegraNegocioError(
        `Não é possível excluir "${fornecedor.razaoSocial}": ele tem ${FornecedorService.descrever(vinculos)}.`
      );
    }
    await TradutorErroBanco.proteger(() => this.fornecedores.excluir(id), {
      emUso: 'Não é possível excluir: o fornecedor tem registros vinculados.'
    });
  }

  private async obter(id: number): Promise<Fornecedor> {
    const fornecedor = await this.fornecedores.buscarPorId(id);
    if (!fornecedor) throw new NaoEncontradoError('Fornecedor', id);
    return fornecedor;
  }

  /** Mensagem amigável antes do UNIQUE do banco (que continua garantindo no fim). */
  private async garantirCnpjLivre(cnpj: string, idAtual?: number): Promise<void> {
    const existente = await this.fornecedores.buscarPorCnpj(cnpj);
    if (existente && existente.id !== idAtual) throw new RegraNegocioError(MSG_CNPJ_DUPLICADO);
  }

  private static opcional(
    dados: Partial<CriarFornecedorDTO>,
    campo: 'contato' | 'telefone' | 'email'
  ): string | null | undefined {
    return campo in dados ? (dados[campo] ?? null) : undefined;
  }

  private static total(v: VinculosFornecedor): number {
    return v.equipamentos + v.manutencoes;
  }

  /** "2 equipamento(s) e 1 manutenção(ões) vinculados" */
  private static descrever(v: VinculosFornecedor): string {
    const partes: string[] = [];
    if (v.equipamentos > 0) partes.push(`${v.equipamentos} equipamento(s)`);
    if (v.manutencoes > 0) partes.push(`${v.manutencoes} manutenção(ões)`);
    return `${partes.join(' e ')} vinculado(s)`;
  }

  private static paraDTO(f: Fornecedor): FornecedorDTO {
    return {
      id: f.id,
      razaoSocial: f.razaoSocial,
      cnpj: f.cnpj,
      tipo: f.tipo,
      contato: f.contato ?? undefined,
      telefone: f.telefone ?? undefined,
      email: f.email ?? undefined
    };
  }
}
