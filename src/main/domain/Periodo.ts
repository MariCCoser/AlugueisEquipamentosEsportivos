import type { DataISO } from '@shared/dto/resposta';
import { ValidacaoError } from '../errors/ErroApp';
import { CalendarioISO } from './CalendarioISO';

/**
 * Período de uma locação: da data de retirada até a data de devolução prevista.
 *
 * Diárias (decidido pelo grupo): diárias = devolução − retirada, mínimo 1.
 * Retira dia 10 e devolve dia 12 = 2 diárias; retira e devolve no mesmo dia = 1.
 *
 * Ocupação do equipamento: o período ocupa TODOS os dias de retirada até a
 * devolução, inclusive. Um item que volta no dia 12 só pode sair de novo no
 * dia 13 (tempo para conferir o estado). É a mesma regra da consulta
 * `ReservaRepository.equipamentoReservadoNoPeriodo`, então tela e banco concordam.
 */
export class Periodo {
  readonly retirada: DataISO;
  readonly devolucaoPrevista: DataISO;

  constructor(retirada: DataISO, devolucaoPrevista: DataISO) {
    if (CalendarioISO.diasEntre(retirada, devolucaoPrevista) < 0) {
      throw new ValidacaoError('A data de devolução não pode ser anterior à de retirada.', {
        dataDevolucaoPrevista: 'Deve ser igual ou posterior à data de retirada.'
      });
    }
    this.retirada = retirada;
    this.devolucaoPrevista = devolucaoPrevista;
  }

  /** Quantidade de diárias cobradas (mínimo 1). */
  diarias(): number {
    return Math.max(1, CalendarioISO.diasEntre(this.retirada, this.devolucaoPrevista));
  }

  /** Dois períodos disputam o mesmo equipamento em pelo menos um dia (bordas inclusivas)? */
  sobrepoe(outro: Periodo): boolean {
    return (
      CalendarioISO.diasEntre(this.retirada, outro.devolucaoPrevista) >= 0 &&
      CalendarioISO.diasEntre(outro.retirada, this.devolucaoPrevista) >= 0
    );
  }

  /** Dias de atraso se o item for devolvido em `dataReal` (0 se no prazo). */
  diasAtraso(dataReal: DataISO): number {
    return Math.max(0, CalendarioISO.diasEntre(this.devolucaoPrevista, dataReal));
  }
}
