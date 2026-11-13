import type { EstrategiaMultaTipo } from '@shared/models/enums';
import { Dinheiro } from '../../domain/Dinheiro';
import { ValidacaoError } from '../../errors/ErroApp';

/** O que toda estratégia precisa saber para calcular a multa de uma reserva. */
export interface ContextoMulta {
  diasAtraso: number;
  /** Soma das diárias de todos os itens da reserva (valor de 1 dia de aluguel). */
  somaDiarias: Dinheiro;
}

/**
 * Padrão Strategy: cada forma de cobrar multa é uma classe que implementa esta
 * interface. O MultaService só conhece a interface, então trocar a regra é
 * trocar o objeto (por configuração), sem if/else espalhados pelo código.
 */
export interface EstrategiaMulta {
  readonly tipo: EstrategiaMultaTipo;
  calcular(contexto: ContextoMulta): Dinheiro;
}

/**
 * Base das estratégias (padrão Template Method): `calcular` faz a parte comum
 * — validar os dias e devolver zero quando não há atraso — e cada subclasse só
 * implementa `calcularAtraso`, que recebe sempre dias > 0.
 */
export abstract class EstrategiaMultaBase implements EstrategiaMulta {
  abstract readonly tipo: EstrategiaMultaTipo;

  calcular(contexto: ContextoMulta): Dinheiro {
    const { diasAtraso } = contexto;
    if (!Number.isInteger(diasAtraso) || diasAtraso < 0) {
      throw new ValidacaoError('Dias de atraso deve ser um número inteiro maior ou igual a zero.');
    }
    if (diasAtraso === 0) return Dinheiro.ZERO;
    return this.calcularAtraso(contexto);
  }

  protected abstract calcularAtraso(contexto: ContextoMulta): Dinheiro;
}
