import type { CaucaoStatus, EstadoConservacao, StatusReserva } from '../models/enums';
import type { PaginacaoDTO, PeriodoDTO } from './comum.dto';
import type { MultaDTO } from './multa.dto';
import type { DataISO } from './resposta';

// ---------- reserva ----------

/** Um equipamento escolhido na hora de criar a reserva. */
export interface EquipamentoEscolhidoDTO {
  equipamentoId: number;
  // A diária NÃO vem da tela: o Main copia do equipamento (assim ninguém altera o preço).
}

export interface CriarReservaDTO extends PeriodoDTO {
  clienteId: number;
  /** Pelo menos um equipamento. */
  itens: EquipamentoEscolhidoDTO[];
  /** 0 = sem caução. */
  valorCaucao: number;
  observacoes?: string;
  // Quem atendeu (usuarioId) também NÃO vem da tela: o Main usa o usuário logado.
}

/** Edição (só reserva PENDENTE): só os campos que vierem são alterados. */
export interface AtualizarReservaDTO extends Partial<CriarReservaDTO> {
  id: number;
}

export interface ReservaDTO extends PeriodoDTO {
  id: number;
  clienteId: number;
  clienteNome: string;
  usuarioId: number;
  dataDevolucaoReal?: DataISO;
  status: StatusReserva;
  valorTotal: number;
  valorCaucao: number;
  caucaoStatus: CaucaoStatus;
  observacoes?: string;
  itens: ItemReservaDTO[];
  /** Soma de tudo o que já foi pago nesta reserva. */
  totalPago: number;
  /** Só existe se a devolução atrasou. */
  multa?: MultaDTO;
}

/** Versão curta da reserva, para listas (sem os itens e a multa). */
export type ReservaResumoDTO = Omit<ReservaDTO, 'itens' | 'multa'> & { qtdItens: number };

export interface ReservaAtrasadaDTO extends ReservaResumoDTO {
  diasAtraso: number;
  /** Quanto daria de multa se o cliente devolvesse hoje. */
  multaPrevista: number;
}

export interface FiltroReservaDTO extends PaginacaoDTO {
  status?: StatusReserva;
  clienteId?: number;
  /** Reservas que tocam este intervalo de datas. */
  dataInicio?: DataISO;
  dataFim?: DataISO;
}

export interface CancelarReservaDTO {
  id: number;
  motivo?: string;
}

// ---------- itens da reserva ----------

/** Adiciona um equipamento a uma reserva que ainda está PENDENTE. */
export interface CriarItemReservaDTO {
  reservaId: number;
  equipamentoId: number;
}

/** Troca o equipamento de um item (reserva PENDENTE). A diária é copiada de novo do equipamento. */
export interface AtualizarItemReservaDTO {
  id: number;
  equipamentoId: number;
}

export interface ItemReservaDTO {
  id: number;
  reservaId: number;
  equipamentoId: number;
  equipamentoNome: string;
  /** Diária copiada do equipamento no dia da reserva. */
  valorDiaria: number;
  estadoRetirada: EstadoConservacao;
  /** Só preenchido depois da devolução. */
  estadoDevolucao?: EstadoConservacao;
}
