import type {
  AtualizarClienteDTO,
  ClienteDTO,
  CriarClienteDTO,
  FiltroClienteDTO
} from '@shared/dto/cliente.dto';
import type { Paginado } from '@shared/dto/resposta';
import type { ClienteRepository } from '../repositories/ClienteRepository';
import type { ReservaRepository } from '../repositories/ReservaRepository';
import { NaoEncontradoError, RegraNegocioError } from '../errors/ErroApp';
import { TradutorErroBanco } from '../errors/TradutorErroBanco';
import { ClienteMapper } from './mapeadores/ClienteMapper';
import { Paginador } from './Paginador';

/** Só o que o service usa de cada repositório (facilita testar com objetos falsos). */
export type RepoClientes = Pick<
  ClienteRepository,
  | 'criar'
  | 'buscarPorId'
  | 'buscarPorCpf'
  | 'pesquisar'
  | 'listarPaginado'
  | 'atualizar'
  | 'excluir'
>;
export type RepoReservasDoCliente = Pick<ReservaRepository, 'listarPorCliente'>;

const MSG_CPF_DUPLICADO = 'Já existe um cliente cadastrado com este CPF.';

/**
 * Regras do cadastro de clientes.
 * A validação de formato (CPF com dígito verificador, e-mail, CEP) é feita antes,
 * pelos schemas da camada de IPC; aqui ficam as regras que dependem do banco.
 */
export class ClienteService {
  /** Limite da busca por nome/CPF antes de paginar. */
  static readonly LIMITE_BUSCA = 500;

  constructor(
    private readonly clientes: RepoClientes,
    private readonly reservas: RepoReservasDoCliente
  ) {}

  async criar(dados: CriarClienteDTO): Promise<ClienteDTO> {
    const novo = ClienteMapper.paraNovo(dados);
    await this.garantirCpfLivre(novo.cpf);
    const criado = await TradutorErroBanco.proteger(() => this.clientes.criar(novo), {
      duplicado: MSG_CPF_DUPLICADO
    });
    return ClienteMapper.paraDTO(criado);
  }

  async listar(filtro: FiltroClienteDTO = {}): Promise<Paginado<ClienteDTO>> {
    const busca = filtro.busca?.trim();
    if (busca) {
      // A busca usa o CPF só com dígitos, então "529.982" também encontra
      const termo = /^[\d.\-\s]+$/.test(busca) ? ClienteMapper.digitos(busca) : busca;
      const encontrados = await this.clientes.pesquisar(termo, ClienteService.LIMITE_BUSCA);
      const pagina = Paginador.paginar(encontrados, filtro);
      return { ...pagina, itens: pagina.itens.map((c) => ClienteMapper.paraDTO(c)) };
    }
    const pagina = await this.clientes.listarPaginado({
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
      ordenarPor: 'nome'
    });
    return { ...pagina, itens: pagina.itens.map((c) => ClienteMapper.paraDTO(c)) };
  }

  async buscarPorId(id: number): Promise<ClienteDTO> {
    return ClienteMapper.paraDTO(await this.obter(id));
  }

  async atualizar({ id, ...dados }: AtualizarClienteDTO): Promise<ClienteDTO> {
    await this.obter(id);
    const alteracoes = ClienteMapper.paraAtualizacao(dados);
    if (alteracoes.cpf !== undefined) await this.garantirCpfLivre(alteracoes.cpf, id);
    const atualizado = await TradutorErroBanco.proteger(
      () => this.clientes.atualizar(id, alteracoes),
      { duplicado: MSG_CPF_DUPLICADO }
    );
    if (!atualizado) throw new NaoEncontradoError('Cliente', id);
    return ClienteMapper.paraDTO(atualizado);
  }

  /** Cliente com reservas não pode ser apagado: o histórico financeiro precisa ficar. */
  async excluir(id: number): Promise<void> {
    await this.obter(id);
    const reservas = await this.reservas.listarPorCliente(id);
    if (reservas.length > 0) {
      throw new RegraNegocioError(
        `Não é possível excluir: o cliente tem ${reservas.length} reserva(s) no histórico.`
      );
    }
    await TradutorErroBanco.proteger(() => this.clientes.excluir(id), {
      emUso: 'Não é possível excluir: o cliente tem registros vinculados.'
    });
  }

  private async obter(id: number) {
    const cliente = await this.clientes.buscarPorId(id);
    if (!cliente) throw new NaoEncontradoError('Cliente', id);
    return cliente;
  }

  /** Mensagem amigável antes do UNIQUE do banco (que continua garantindo no fim). */
  private async garantirCpfLivre(cpf: string, idAtual?: number): Promise<void> {
    const existente = await this.clientes.buscarPorCpf(cpf);
    if (existente && existente.id !== idAtual) {
      throw new RegraNegocioError(MSG_CPF_DUPLICADO);
    }
  }
}
