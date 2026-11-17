import { describe, expect, it } from 'vitest';
import { cnpjValido, formatarCnpj } from '../../src/shared/validadores/cnpj';

describe('cnpjValido', () => {
  it('aceita CNPJs válidos com e sem pontuação', () => {
    expect(cnpjValido('11222333000181')).toBe(true);
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('45.678.901/0001-75')).toBe(true);
  });

  it('aceita dígito verificador 0 (resto menor que 2)', () => {
    // 11.444.777/0001-61 e 00.000.000/0001-91 (Banco do Brasil) são exemplos conhecidos
    expect(cnpjValido('00000000000191')).toBe(true);
    expect(cnpjValido('11444777000161')).toBe(true);
  });

  it('recusa dígito verificador errado', () => {
    expect(cnpjValido('11222333000182')).toBe(false);
    expect(cnpjValido('11222333000171')).toBe(false);
  });

  it('recusa todos os dígitos iguais', () => {
    expect(cnpjValido('00000000000000')).toBe(false);
    expect(cnpjValido('11.111.111/1111-11')).toBe(false);
  });

  it('recusa tamanho errado', () => {
    expect(cnpjValido('1122233300018')).toBe(false);
    expect(cnpjValido('112223330001811')).toBe(false);
    expect(cnpjValido('')).toBe(false);
  });
});

describe('formatarCnpj', () => {
  it('formata o CNPJ completo', () => {
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('serve de máscara enquanto a pessoa digita', () => {
    expect(formatarCnpj('112')).toBe('11.2');
    expect(formatarCnpj('11222333')).toBe('11.222.333');
    expect(formatarCnpj('112223330001')).toBe('11.222.333/0001');
  });

  it('ignora letras e dígitos a mais', () => {
    expect(formatarCnpj('11a222b333000181999')).toBe('11.222.333/0001-81');
  });
});
