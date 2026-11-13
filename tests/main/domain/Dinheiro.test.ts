import { describe, expect, it } from 'vitest';
import { Dinheiro } from '../../../src/main/domain/Dinheiro';
import { ValidacaoError } from '../../../src/main/errors/DominioError';

describe('Dinheiro', () => {
  it('converte reais em centavos sem erro de ponto flutuante', () => {
    expect(Dinheiro.deReais(45.1).centavos).toBe(4510);
    expect(Dinheiro.deReais(0.1).somar(Dinheiro.deReais(0.2)).emReais()).toBe(0.3);
  });

  it('multiplica diária por dias de forma exata', () => {
    expect(Dinheiro.deReais(45.1).multiplicar(3).emReais()).toBe(135.3);
  });

  it('soma uma lista de valores', () => {
    const total = Dinheiro.somarTodos([45, 90, 70].map((v) => Dinheiro.deReais(v)));
    expect(total.emReais()).toBe(205);
    expect(Dinheiro.somarTodos([]).ehZero()).toBe(true);
  });

  it('arredonda porcentagens para o centavo mais próximo', () => {
    expect(Dinheiro.deReais(10.05).porcentagem(10).centavos).toBe(101); // 100,5 -> 101
    expect(Dinheiro.deReais(135).porcentagem(30).emReais()).toBe(40.5);
  });

  it('compara valores', () => {
    const a = Dinheiro.deReais(10);
    expect(a.maiorOuIgual(Dinheiro.deReais(10))).toBe(true);
    expect(a.maiorOuIgual(Dinheiro.deReais(10.01))).toBe(false);
    expect(a.igual(Dinheiro.deCentavos(1000))).toBe(true);
    expect(a.subtrair(Dinheiro.deReais(15)).ehNegativo()).toBe(true);
  });

  it('formata em reais', () => {
    expect(Dinheiro.deReais(1234.5).formatar().replace(/\s/g, ' ')).toBe('R$ 1.234,50');
  });

  it('rejeita valores inválidos', () => {
    expect(() => Dinheiro.deReais(Number.NaN)).toThrow(ValidacaoError);
    expect(() => Dinheiro.deCentavos(1.5)).toThrow(ValidacaoError);
    expect(() => Dinheiro.deReais(10).multiplicar(1.5)).toThrow(ValidacaoError);
    expect(() => Dinheiro.deReais(10).porcentagem(-1)).toThrow(ValidacaoError);
  });
});
