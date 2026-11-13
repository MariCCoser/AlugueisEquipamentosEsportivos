import { describe, expect, it } from 'vitest';
import { CalendarioISO } from '../../../src/main/domain/CalendarioISO';
import { ValidacaoError } from '../../../src/main/errors/DominioError';

describe('CalendarioISO', () => {
  it('conta dias entre datas, inclusive virando mês e ano', () => {
    expect(CalendarioISO.diasEntre('2026-11-10', '2026-11-12')).toBe(2);
    expect(CalendarioISO.diasEntre('2026-12-30', '2027-01-02')).toBe(3);
    expect(CalendarioISO.diasEntre('2028-02-28', '2028-03-01')).toBe(2); // ano bissexto
    expect(CalendarioISO.diasEntre('2026-11-12', '2026-11-10')).toBe(-2);
  });

  it('soma dias', () => {
    expect(CalendarioISO.somarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(CalendarioISO.somarDias('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('rejeita formato errado e datas que não existem', () => {
    expect(() => CalendarioISO.paraNumeroDia('13/11/2026')).toThrow(ValidacaoError);
    expect(() => CalendarioISO.paraNumeroDia('2026-02-30')).toThrow(ValidacaoError);
    expect(CalendarioISO.ehValida('2026-02-29')).toBe(false);
    expect(CalendarioISO.ehValida('2028-02-29')).toBe(true);
  });

  it('hoje usa a data local, com zero à esquerda', () => {
    expect(CalendarioISO.hoje(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
