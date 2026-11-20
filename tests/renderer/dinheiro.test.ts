import { describe, expect, it } from 'vitest';
import { lerDinheiro } from '../../src/renderer/util/dinheiro';

describe('lerDinheiro', () => {
  it('aceita ponto ou vírgula', () => {
    expect(lerDinheiro('45.5')).toEqual({ valor: 45.5 });
    expect(lerDinheiro('45,50')).toEqual({ valor: 45.5 });
  });

  it('recusa vazio, zero, negativo e texto', () => {
    for (const texto of ['', '0', '-3', 'abc']) {
      expect(lerDinheiro(texto).erro).toBe('Informe um valor maior que zero.');
    }
  });

  it('com permitirZero, vazio e zero valem 0', () => {
    expect(lerDinheiro('', { permitirZero: true })).toEqual({ valor: 0 });
    expect(lerDinheiro('0', { permitirZero: true })).toEqual({ valor: 0 });
    expect(lerDinheiro('-1', { permitirZero: true }).erro).toBe(
      'Informe um valor igual ou maior que zero.'
    );
  });

  it('recusa mais de 2 casas decimais, tolerando o ponto flutuante', () => {
    expect(lerDinheiro('10.005').erro).toBe('Use no máximo 2 casas decimais.');
    expect(lerDinheiro('45.10')).toEqual({ valor: 45.1 });
  });
});
