import { describe, expect, it } from 'vitest';
import { Periodo } from '../../../src/main/domain/Periodo';
import { ValidacaoError } from '../../../src/main/errors/ErroApp';

describe('Periodo', () => {
  describe('diárias', () => {
    it('retira dia 10 e devolve dia 12 = 2 diárias', () => {
      expect(new Periodo('2026-11-10', '2026-11-12').diarias()).toBe(2);
    });

    it('retira e devolve no mesmo dia = 1 diária', () => {
      expect(new Periodo('2026-11-10', '2026-11-10').diarias()).toBe(1);
    });

    it('devolução antes da retirada é inválida', () => {
      expect(() => new Periodo('2026-11-12', '2026-11-10')).toThrow(ValidacaoError);
    });
  });

  describe('sobreposição (bordas inclusivas)', () => {
    const base = new Periodo('2026-11-10', '2026-11-12');

    it.each([
      ['dentro', '2026-11-11', '2026-11-11', true],
      ['englobando', '2026-11-01', '2026-11-30', true],
      ['começa no dia da devolução', '2026-11-12', '2026-11-14', true],
      ['termina no dia da retirada', '2026-11-08', '2026-11-10', true],
      ['termina na véspera', '2026-11-05', '2026-11-09', false],
      ['começa no dia seguinte', '2026-11-13', '2026-11-15', false]
    ])('%s', (_caso, retirada, devolucao, esperado) => {
      const outro = new Periodo(retirada, devolucao);
      expect(base.sobrepoe(outro)).toBe(esperado);
      expect(outro.sobrepoe(base)).toBe(esperado); // simétrico
    });
  });

  describe('dias de atraso', () => {
    const periodo = new Periodo('2026-11-10', '2026-11-12');

    it('é zero se devolvido no prazo ou antes', () => {
      expect(periodo.diasAtraso('2026-11-12')).toBe(0);
      expect(periodo.diasAtraso('2026-11-11')).toBe(0);
    });

    it('conta os dias após a data prevista', () => {
      expect(periodo.diasAtraso('2026-11-15')).toBe(3);
    });
  });
});
