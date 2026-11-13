import type { Dinheiro } from '../../domain/Dinheiro';
import { ValidacaoError } from '../../errors/DominioError';
import { EstrategiaMultaBase, type ContextoMulta } from './EstrategiaMulta';

/**
 * Multa = X% da soma das diárias, por dia de atraso. Padrão do grupo: 10%.
 *
 * Ex.: diárias somando R$ 135,00, 3 dias de atraso, 10% → 135 × 10% × 3 = R$ 40,50.
 * O arredondamento acontece uma única vez, no total.
 */
export class MultaPercentual extends EstrategiaMultaBase {
  static readonly PERCENTUAL_PADRAO = 10;
  readonly tipo = 'PERCENTUAL';

  constructor(private readonly percentualPorDia: number = MultaPercentual.PERCENTUAL_PADRAO) {
    super();
    if (!Number.isFinite(percentualPorDia) || percentualPorDia <= 0) {
      throw new ValidacaoError('O percentual da multa deve ser maior que zero.');
    }
  }

  protected calcularAtraso({ diasAtraso, somaDiarias }: ContextoMulta): Dinheiro {
    return somaDiarias.porcentagem(this.percentualPorDia * diasAtraso);
  }
}
