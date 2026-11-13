import type { StatusReserva } from '@shared/models/enums';
import { RegraNegocioError } from './DominioError';

/** Motivos pelos quais um equipamento não pode entrar numa reserva. */
export type MotivoIndisponivel =
  'RESERVADO_NO_PERIODO' | 'EM_MANUTENCAO' | 'INDISPONIVEL' | 'SOMENTE_VENDA';

const TEXTO_MOTIVO: Record<MotivoIndisponivel, string> = {
  RESERVADO_NO_PERIODO: 'já está reservado no período',
  EM_MANUTENCAO: 'está em manutenção',
  INDISPONIVEL: 'está indisponível',
  SOMENTE_VENDA: 'é somente para venda'
};

export class EquipamentoIndisponivelError extends RegraNegocioError {
  constructor(
    readonly equipamento: string,
    readonly motivo: MotivoIndisponivel
  ) {
    super(`O equipamento "${equipamento}" ${TEXTO_MOTIVO[motivo]}.`);
  }
}

/** Tentativa de mudar o status da reserva por um caminho não permitido. */
export class TransicaoInvalidaError extends RegraNegocioError {
  constructor(
    readonly de: StatusReserva,
    readonly para: StatusReserva
  ) {
    super(`Não é possível mudar a reserva de ${de} para ${para}.`);
  }
}
