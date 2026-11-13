import type { DataISO } from '../dto/resposta';
import type {
  CaucaoStatus,
  EstadoConservacao,
  FormaPagamento,
  Modalidade,
  Perfil,
  StatusEquipamento,
  StatusReserva,
  TipoFornecedor,
  TipoManutencao,
  TipoPagamento
} from './enums';

/**
 * Entidades = uma linha de cada tabela, com os nomes em camelCase.
 * - Colunas que aceitam NULL viram `tipo | null`.
 * - DATE vem como 'YYYY-MM-DD' e DATETIME como 'YYYY-MM-DD HH:MM:SS' (string).
 * - TINYINT(1) vira boolean e DECIMAL vira number.
 *
 * São o formato que os repositórios devolvem. O que vai para a tela são os DTOs
 * (ex.: o Usuario tem `senhaHash`, que nunca pode sair do Main).
 */
export interface Registro {
  id: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Dados para criar um registro: tudo menos id/createdAt/updatedAt.
 * Os campos em `Opcionais` (têm valor padrão no banco ou aceitam NULL) podem ser omitidos.
 */
export type Novo<E extends Registro, Opcionais extends keyof E = never> = Omit<
  E,
  keyof Registro | Opcionais
> & { [K in Opcionais]?: E[K] };

export interface Usuario extends Registro {
  nome: string;
  email: string;
  senhaHash: string;
  perfil: Perfil;
  ativo: boolean;
  ultimoLogin: string | null;
}
export type NovoUsuario = Novo<Usuario, 'perfil' | 'ativo' | 'ultimoLogin'>;

export interface Cliente extends Registro {
  nome: string;
  cpf: string;
  telefone: string;
  email: string | null;
  cep: string;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
}
export type NovoCliente = Novo<Cliente, 'email' | 'complemento'>;

export interface Categoria extends Registro {
  nome: string;
  descricao: string | null;
  sensivelClima: boolean;
}
export type NovaCategoria = Novo<Categoria, 'descricao' | 'sensivelClima'>;

export interface Fornecedor extends Registro {
  razaoSocial: string;
  cnpj: string;
  tipo: TipoFornecedor;
  contato: string | null;
  telefone: string | null;
  email: string | null;
}
export type NovoFornecedor = Novo<Fornecedor, 'contato' | 'telefone' | 'email'>;

export interface Equipamento extends Registro {
  nome: string;
  descricao: string | null;
  modalidade: Modalidade;
  estadoConservacao: EstadoConservacao;
  status: StatusEquipamento;
  valorDiaria: number | null;
  precoVenda: number | null;
  dataAquisicao: DataISO | null;
  categoriaId: number;
  fornecedorId: number | null;
}
export type NovoEquipamento = Novo<
  Equipamento,
  | 'descricao'
  | 'estadoConservacao'
  | 'status'
  | 'valorDiaria'
  | 'precoVenda'
  | 'dataAquisicao'
  | 'fornecedorId'
>;

export interface Reserva extends Registro {
  clienteId: number;
  usuarioId: number;
  dataRetirada: DataISO;
  dataDevolucaoPrevista: DataISO;
  dataDevolucaoReal: DataISO | null;
  status: StatusReserva;
  valorTotal: number;
  valorCaucao: number;
  caucaoStatus: CaucaoStatus;
  observacoes: string | null;
}
export type NovaReserva = Novo<
  Reserva,
  'dataDevolucaoReal' | 'status' | 'valorTotal' | 'valorCaucao' | 'caucaoStatus' | 'observacoes'
>;

export interface ItemReserva extends Registro {
  reservaId: number;
  equipamentoId: number;
  valorDiaria: number;
  estadoRetirada: EstadoConservacao;
  estadoDevolucao: EstadoConservacao | null;
}
export type NovoItemReserva = Novo<ItemReserva, 'estadoDevolucao'>;

export interface Manutencao extends Registro {
  equipamentoId: number;
  fornecedorId: number;
  tipo: TipoManutencao;
  descricao: string;
  dataEnvio: DataISO;
  dataRetorno: DataISO | null;
  custo: number | null;
  estadoRetorno: EstadoConservacao | null;
}
export type NovaManutencao = Novo<Manutencao, 'dataRetorno' | 'custo' | 'estadoRetorno'>;

export interface Multa extends Registro {
  reservaId: number;
  diasAtraso: number;
  valor: number;
  quitada: boolean;
  dataQuitacao: string | null;
}
export type NovaMulta = Novo<Multa, 'quitada' | 'dataQuitacao'>;

export interface Pagamento extends Registro {
  reservaId: number;
  multaId: number | null;
  tipo: TipoPagamento;
  forma: FormaPagamento;
  valor: number;
  data: string;
}
export type NovoPagamento = Novo<Pagamento, 'multaId' | 'data'>;
