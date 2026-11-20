import { describe, expect, it } from 'vitest';
import {
  formatarCep,
  formatarData,
  formatarMoeda,
  formatarTelefone,
  pluralizar
} from '../../src/renderer/util/formatadores';

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

describe('formatarTelefone', () => {
  it('formata fixo e celular', () => {
    expect(formatarTelefone('1133334444')).toBe('(11) 3333-4444');
    expect(formatarTelefone('11987654321')).toBe('(11) 98765-4321');
  });

  it('serve de máscara enquanto a pessoa digita', () => {
    expect(formatarTelefone('')).toBe('');
    expect(formatarTelefone('1')).toBe('(1');
    expect(formatarTelefone('113')).toBe('(11) 3');
    expect(formatarTelefone('11333344')).toBe('(11) 3333-44');
  });
});

describe('formatarCep', () => {
  it('coloca o traço depois do 5º dígito', () => {
    expect(formatarCep('01310100')).toBe('01310-100');
    expect(formatarCep('01310-100')).toBe('01310-100');
  });

  it('formata parcialmente enquanto a pessoa digita', () => {
    expect(formatarCep('01310')).toBe('01310');
    expect(formatarCep('013101')).toBe('01310-1');
    expect(formatarCep('013101009')).toBe('01310-100');
  });
});
