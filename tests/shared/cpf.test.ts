import { describe, expect, it } from 'vitest';
import { cpfValido, formatarCpf } from '../../src/shared/validadores/cpf';

describe('cpfValido', () => {
  it('aceita CPFs válidos com e sem pontuação', () => {
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('12345678909')).toBe(true);
    expect(cpfValido('11144477735')).toBe(true);
  });

  it('aceita dígito verificador 0 (resto menor que 2)', () => {
    expect(cpfValido('98765432100')).toBe(true);
  });

  it('recusa dígito verificador errado', () => {
    expect(cpfValido('52998224726')).toBe(false);
    expect(cpfValido('52998224735')).toBe(false);
  });

  it('recusa todos os dígitos iguais', () => {
    expect(cpfValido('00000000000')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
  });

  it('recusa tamanho errado', () => {
    expect(cpfValido('5299822472')).toBe(false);
    expect(cpfValido('529982247250')).toBe(false);
    expect(cpfValido('')).toBe(false);
  });
});

describe('formatarCpf', () => {
  it('coloca pontos e traço', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
  });

  it('formata parcialmente enquanto a pessoa digita', () => {
    expect(formatarCpf('529')).toBe('529');
    expect(formatarCpf('5299')).toBe('529.9');
    expect(formatarCpf('5299822')).toBe('529.982.2');
    expect(formatarCpf('5299822472')).toBe('529.982.247-2');
  });

  it('ignora o que não é dígito e corta no 11º dígito', () => {
    expect(formatarCpf('529.982.247-25999')).toBe('529.982.247-25');
    expect(formatarCpf('abc')).toBe('');
  });
});
