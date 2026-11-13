import { describe, expect, it } from 'vitest';
import { Dinheiro } from '../../../../src/main/domain/Dinheiro';
import { ValidacaoError } from '../../../../src/main/errors/ErroApp';
import { FabricaEstrategiaMulta } from '../../../../src/main/services/multa/FabricaEstrategiaMulta';
import { MultaDiariaFixa } from '../../../../src/main/services/multa/MultaDiariaFixa';
import { MultaPercentual } from '../../../../src/main/services/multa/MultaPercentual';

const somaDiarias = Dinheiro.deReais(135); // ex.: bike 45 + caiaque 90

describe('MultaPercentual', () => {
  it('padrão é 10% da soma das diárias por dia de atraso', () => {
    const multa = new MultaPercentual().calcular({ diasAtraso: 3, somaDiarias });
    expect(multa.emReais()).toBe(40.5); // 135 × 10% × 3
  });

  it('aceita outro percentual', () => {
    const multa = new MultaPercentual(5).calcular({ diasAtraso: 2, somaDiarias });
    expect(multa.emReais()).toBe(13.5);
  });

  it('arredonda só no total', () => {
    const multa = new MultaPercentual().calcular({
      diasAtraso: 3,
      somaDiarias: Dinheiro.deReais(10.05)
    });
    expect(multa.centavos).toBe(302); // 1005 × 30% = 301,5 -> 302
  });

  it('percentual zero ou negativo é inválido', () => {
    expect(() => new MultaPercentual(0)).toThrow(ValidacaoError);
  });
});

describe('MultaDiariaFixa', () => {
  it('cobra valor fixo por dia, independente do aluguel', () => {
    const estrategia = new MultaDiariaFixa(Dinheiro.deReais(20));
    expect(estrategia.calcular({ diasAtraso: 3, somaDiarias }).emReais()).toBe(60);
  });

  it('valor zero é inválido', () => {
    expect(() => new MultaDiariaFixa(Dinheiro.ZERO)).toThrow(ValidacaoError);
  });
});

describe.each([
  ['MultaPercentual', new MultaPercentual()],
  ['MultaDiariaFixa', new MultaDiariaFixa(Dinheiro.deReais(20))]
])('regras comuns (%s)', (_nome, estrategia) => {
  it('sem atraso não há multa', () => {
    expect(estrategia.calcular({ diasAtraso: 0, somaDiarias }).ehZero()).toBe(true);
  });

  it('rejeita dias negativos ou fracionados', () => {
    expect(() => estrategia.calcular({ diasAtraso: -1, somaDiarias })).toThrow(ValidacaoError);
    expect(() => estrategia.calcular({ diasAtraso: 1.5, somaDiarias })).toThrow(ValidacaoError);
  });
});

describe('FabricaEstrategiaMulta', () => {
  it('sem configuração cria a percentual de 10%', () => {
    const estrategia = FabricaEstrategiaMulta.criar();
    expect(estrategia.tipo).toBe('PERCENTUAL');
    expect(estrategia.calcular({ diasAtraso: 1, somaDiarias }).emReais()).toBe(13.5);
  });

  it('cria a diária fixa com o valor configurado', () => {
    const estrategia = FabricaEstrategiaMulta.criar({ tipo: 'DIARIA_FIXA', valorPorDiaReais: 25 });
    expect(estrategia.tipo).toBe('DIARIA_FIXA');
    expect(estrategia.calcular({ diasAtraso: 2, somaDiarias }).emReais()).toBe(50);
  });
});
