import { ValidacaoError } from '../errors/ErroApp';

/**
 * Valor monetário guardado em CENTAVOS inteiros.
 *
 * Por quê: `number` é ponto flutuante, então 0.1 + 0.2 = 0.30000000000000004.
 * Somando diárias e multas isso gera centavos "fantasmas". Em centavos inteiros
 * toda soma/multiplicação por inteiro é exata; o arredondamento só acontece em
 * porcentagens, sempre do mesmo jeito (meio para cima).
 *
 * Objeto imutável: toda operação devolve um novo Dinheiro.
 */
export class Dinheiro {
  static readonly ZERO = new Dinheiro(0);

  private constructor(readonly centavos: number) {}

  /** Converte o valor em reais vindo do banco (DECIMAL(10,2)) ou da tela. */
  static deReais(reais: number): Dinheiro {
    if (!Number.isFinite(reais)) {
      throw new ValidacaoError('Valor monetário inválido.');
    }
    return new Dinheiro(Math.round(reais * 100));
  }

  static deCentavos(centavos: number): Dinheiro {
    if (!Number.isInteger(centavos)) {
      throw new ValidacaoError('Centavos precisam ser um número inteiro.');
    }
    return new Dinheiro(centavos);
  }

  static somarTodos(valores: readonly Dinheiro[]): Dinheiro {
    return valores.reduce((total, valor) => total.somar(valor), Dinheiro.ZERO);
  }

  somar(outro: Dinheiro): Dinheiro {
    return new Dinheiro(this.centavos + outro.centavos);
  }

  subtrair(outro: Dinheiro): Dinheiro {
    return new Dinheiro(this.centavos - outro.centavos);
  }

  /** Multiplica por uma quantidade inteira (ex.: diária × dias). */
  multiplicar(quantidade: number): Dinheiro {
    if (!Number.isInteger(quantidade)) {
      throw new ValidacaoError('Quantidade precisa ser um número inteiro.');
    }
    return new Dinheiro(this.centavos * quantidade);
  }

  /** Aplica uma porcentagem (ex.: 10 = 10%), arredondando para o centavo mais próximo. */
  porcentagem(percentual: number): Dinheiro {
    if (!Number.isFinite(percentual) || percentual < 0) {
      throw new ValidacaoError('Percentual inválido.');
    }
    return new Dinheiro(Math.round((this.centavos * percentual) / 100));
  }

  emReais(): number {
    return this.centavos / 100;
  }

  ehZero(): boolean {
    return this.centavos === 0;
  }

  ehNegativo(): boolean {
    return this.centavos < 0;
  }

  igual(outro: Dinheiro): boolean {
    return this.centavos === outro.centavos;
  }

  maiorOuIgual(outro: Dinheiro): boolean {
    return this.centavos >= outro.centavos;
  }

  /** Formato pt-BR, ex.: "R$ 1.234,50". */
  formatar(): string {
    return this.emReais().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
