import type { EstadoConservacao, TipoManutencao } from '../models/enums';
import type { DataISO } from './resposta';

/** Envio de um equipamento para o conserto. Ele passa a ficar EM_MANUTENCAO. */
export interface CriarManutencaoDTO {
  equipamentoId: number;
  /** Precisa ser um fornecedor do tipo MANUTENCAO. */
  fornecedorId: number;
  tipo: TipoManutencao;
  descricao: string;
  dataEnvio: DataISO;
}

/** Correção: só os campos que vierem são alterados. */
export interface AtualizarManutencaoDTO {
  id: number;
  tipo?: TipoManutencao;
  descricao?: string;
  dataEnvio?: DataISO;
  custo?: number;
}

/** Volta do conserto. O equipamento fica DISPONIVEL de novo. */
export interface RegistrarRetornoDTO {
  id: number;
  dataRetorno: DataISO;
  custo?: number;
  /** Como o equipamento voltou (vira o novo estado de conservação dele). */
  estadoRetorno: EstadoConservacao;
}

export interface ManutencaoDTO {
  id: number;
  equipamentoId: number;
  equipamentoNome: string;
  fornecedorId: number;
  fornecedorNome: string;
  tipo: TipoManutencao;
  descricao: string;
  dataEnvio: DataISO;
  /** Vazio enquanto o equipamento ainda está no conserto. */
  dataRetorno?: DataISO;
  custo?: number;
  estadoRetorno?: EstadoConservacao;
}

export interface FiltroManutencaoDTO {
  /** true = só as que ainda não voltaram. */
  abertas?: boolean;
  tipo?: TipoManutencao;
  fornecedorId?: number;
}

/** Entrada de `manutencoes:listarPorEquipamento`. */
export interface EquipamentoIdDTO {
  equipamentoId: number;
}
