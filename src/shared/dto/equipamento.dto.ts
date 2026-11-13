import type { EstadoConservacao, Modalidade, StatusEquipamento } from '../models/enums';
import type { PaginacaoDTO, PeriodoDTO } from './comum.dto';
import type { DataISO } from './resposta';

export interface CriarEquipamentoDTO {
  nome: string;
  descricao?: string;
  /** LOCACAO = para alugar; VENDA = para vender. */
  modalidade: Modalidade;
  estadoConservacao: EstadoConservacao;
  /** Obrigatório quando a modalidade é LOCACAO. */
  valorDiaria?: number;
  /** Obrigatório quando a modalidade é VENDA. */
  precoVenda?: number;
  dataAquisicao?: DataISO;
  categoriaId: number;
  /** Fornecedor de quem o item foi comprado (precisa ser do tipo COMPRA). */
  fornecedorId?: number;
}

/** Edição: só os campos que vierem são alterados. */
export interface AtualizarEquipamentoDTO extends Partial<CriarEquipamentoDTO> {
  id: number;
}

export interface EquipamentoDTO extends CriarEquipamentoDTO {
  id: number;
  status: StatusEquipamento;
  categoriaNome: string;
  /** Vem da categoria: se true, a reserva mostra a previsão do tempo. */
  sensivelClima: boolean;
  fornecedorNome?: string;
}

export interface FiltroEquipamentoDTO extends PaginacaoDTO {
  categoriaId?: number;
  modalidade?: Modalidade;
  status?: StatusEquipamento;
  estadoConservacao?: EstadoConservacao;
  /** Parte do nome. */
  busca?: string;
}

export interface VerificarDisponibilidadeDTO extends PeriodoDTO {
  equipamentoId: number;
  /** Ao editar uma reserva, informe o id dela para não conflitar com ela mesma. */
  ignorarReservaId?: number;
}

export interface DisponibilidadeDTO {
  disponivel: boolean;
  /** Por que não está disponível (só vem quando `disponivel` é false). */
  motivo?: 'RESERVADO_NO_PERIODO' | 'EM_MANUTENCAO' | 'INDISPONIVEL' | 'SOMENTE_VENDA';
}

/** Entrada de `equipamentos:listarDisponiveis` (assistente de nova reserva). */
export interface ListarDisponiveisDTO extends PeriodoDTO {
  categoriaId?: number;
}

/** Só estes dois status podem ser trocados à mão; os outros mudam sozinhos (reserva/manutenção). */
export interface AlterarStatusEquipamentoDTO {
  id: number;
  status: Extract<StatusEquipamento, 'DISPONIVEL' | 'INDISPONIVEL'>;
}
