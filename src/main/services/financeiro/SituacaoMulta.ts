import type { Multa } from '@shared/models/entidades';
import { Dinheiro } from '../../domain/Dinheiro';
import type { Repositorios } from '../../repositories';

/**
 * "A multa está paga?" — uma regra só, usada por todo mundo que mexe em
 * pagamentos de multa (quitar, pagamento avulso, estorno, caução na devolução).
 *
 * Quitada  ⇔  soma dos pagamentos do tipo MULTA >= valor da multa.
 */
export class SituacaoMulta {
  constructor(private readonly repos: Pick<Repositorios, 'multas' | 'pagamentos'>) {}

  async valorPago(multaId: number): Promise<Dinheiro> {
    return Dinheiro.deReais(await this.repos.pagamentos.somarPorMulta(multaId));
  }

  /** Quanto ainda falta pagar (nunca negativo). */
  async saldo(multa: Multa): Promise<Dinheiro> {
    const falta = Dinheiro.deReais(multa.valor).subtrair(await this.valorPago(multa.id));
    return falta.ehNegativo() ? Dinheiro.ZERO : falta;
  }

  /** Marca como quitada ou reabre, conforme os pagamentos atuais. */
  async atualizar(multaId: number): Promise<void> {
    const multa = await this.repos.multas.buscarPorId(multaId);
    if (!multa) return;
    const pago = await this.valorPago(multaId);
    const cobre = pago.maiorOuIgual(Dinheiro.deReais(multa.valor));
    if (cobre && !multa.quitada) await this.repos.multas.quitar(multaId);
    if (!cobre && multa.quitada) await this.repos.multas.reabrir(multaId);
  }
}
