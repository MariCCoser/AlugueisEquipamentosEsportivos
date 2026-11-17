import { describe, expect, it } from 'vitest';
import { formatarData, formatarMoeda, pluralizar } from '../../src/renderer/util/formatadores';

describe('formatarMoeda', () => {
  it('usa o padrão brasileiro', () => {
    expect(formatarMoeda(1234.5)).toBe('R$ 1.234,50');
    expect(formatarMoeda(0)).toBe('R$ 0,00');
  });
});

describe('formatarData', () => {
  it('converte ISO para dd/mm/aaaa sem erro de fuso', () => {
    expect(formatarData('2026-01-01')).toBe('01/01/2026');
  });

  it('ignora a hora quando vier junto', () => {
    expect(formatarData('2026-11-17T23:30:00Z')).toBe('17/11/2026');
  });

  it('devolve o texto original se não for uma data ISO', () => {
    expect(formatarData('ontem')).toBe('ontem');
  });
});

describe('pluralizar', () => {
  it('escolhe singular ou plural', () => {
    expect(pluralizar(1, 'item', 'itens')).toBe('1 item');
    expect(pluralizar(3, 'item', 'itens')).toBe('3 itens');
  });
});
