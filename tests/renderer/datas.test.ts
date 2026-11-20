import { describe, expect, it } from 'vitest';
import { diariasDoPeriodo, diasEntre, hojeISO, somarDias } from '../../src/renderer/util/datas';

describe('hojeISO', () => {
  it('usa o dia local, com zeros à esquerda', () => {
    expect(hojeISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('somarDias', () => {
  it('passa de mês e de ano', () => {
    expect(somarDias('2026-11-30', 2)).toBe('2026-12-02');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('subtrai com número negativo e respeita ano bissexto', () => {
    expect(somarDias('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('diasEntre', () => {
  it('conta os dias entre duas datas', () => {
    expect(diasEntre('2026-11-17', '2026-11-20')).toBe(3);
    expect(diasEntre('2026-11-20', '2026-11-17')).toBe(-3);
    expect(diasEntre('2026-11-17', '2026-11-17')).toBe(0);
  });

  it('não erra na troca de horário de verão', () => {
    expect(diasEntre('2018-11-03', '2018-11-05')).toBe(2);
  });
});

describe('diariasDoPeriodo', () => {
  it('cobra os dias do período', () => {
    expect(diariasDoPeriodo('2026-11-17', '2026-11-20')).toBe(3);
  });

  it('retirar e devolver no mesmo dia cobra uma diária', () => {
    expect(diariasDoPeriodo('2026-11-17', '2026-11-17')).toBe(1);
  });
});
