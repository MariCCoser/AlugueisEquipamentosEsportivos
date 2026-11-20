import { describe, expect, it } from 'vitest';
import { infoPagina } from '../../src/renderer/util/paginacao';

const pagina = (numero: number, qtdItens: number, total: number, porPagina = 20) => ({
  itens: Array.from({ length: qtdItens }, (_, i) => i),
  total,
  pagina: numero,
  porPagina
});

describe('infoPagina', () => {
  it('primeira página de várias', () => {
    expect(infoPagina(pagina(1, 20, 45))).toEqual({
      totalPaginas: 3,
      primeiro: 1,
      ultimo: 20,
      temAnterior: false,
      temProxima: true
    });
  });

  it('página do meio e última página incompleta', () => {
    expect(infoPagina(pagina(2, 20, 45))).toMatchObject({ primeiro: 21, ultimo: 40 });
    expect(infoPagina(pagina(3, 5, 45))).toMatchObject({
      primeiro: 41,
      ultimo: 45,
      temAnterior: true,
      temProxima: false
    });
  });

  it('total exato em páginas cheias', () => {
    expect(infoPagina(pagina(2, 20, 40)).totalPaginas).toBe(2);
  });

  it('lista vazia conta como uma página só', () => {
    expect(infoPagina(pagina(1, 0, 0))).toEqual({
      totalPaginas: 1,
      primeiro: 0,
      ultimo: 0,
      temAnterior: false,
      temProxima: false
    });
  });
});
