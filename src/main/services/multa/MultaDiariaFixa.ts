import type { Dinheiro } from '../../domain/Dinheiro';
import { ValidacaoError } from '../../errors/DominioError';
import { EstrategiaMultaBase, type ContextoMulta } from './EstrategiaMulta';

/**
 * Multa = valor fixo por dia de atraso, independente de quanto custa o aluguel.
 * Ex.: R$ 20,00 por dia, 3 dias de atraso → R$ 60,00.
 */
export class MultaDiariaFixa extends EstrategiaMultaBase {
  readonly tipo = 'DIARIA_FIXA';

  constructor(private readonly valorPorDia: Dinheiro) {
    super();
    if (valorPorDia.ehZero() || valorPorDia.ehNegativo()) {
      throw new ValidacaoError('O valor diário da multa deve ser maior que zero.');
    }
  }

  protected calcularAtraso({ diasAtraso }: ContextoMulta): Dinheiro {
    return this.valorPorDia.multiplicar(diasAtraso);
  }
}
