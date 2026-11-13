import { Dinheiro } from '../../domain/Dinheiro';
import type { EstrategiaMulta } from './EstrategiaMulta';
import { MultaDiariaFixa } from './MultaDiariaFixa';
import { MultaPercentual } from './MultaPercentual';

/** Configuração da multa (virá do .env: MULTA_ESTRATEGIA e o valor correspondente). */
export type ConfigMulta =
  | { tipo: 'PERCENTUAL'; percentualPorDia?: number }
  | { tipo: 'DIARIA_FIXA'; valorPorDiaReais: number };

/** Cria a estratégia de multa escolhida na configuração. Padrão: 10% por dia. */
export class FabricaEstrategiaMulta {
  static criar(config: ConfigMulta = { tipo: 'PERCENTUAL' }): EstrategiaMulta {
    switch (config.tipo) {
      case 'PERCENTUAL':
        return new MultaPercentual(config.percentualPorDia);
      case 'DIARIA_FIXA':
        return new MultaDiariaFixa(Dinheiro.deReais(config.valorPorDiaReais));
    }
  }
}
