import { describe, expect, it } from 'vitest';
import {
  formatarData,
  formatarDinheiro,
  juntarNomes,
  textoAvisoMulta
} from '../../api-notificacoes/src/mensagens';

describe('mensagens', () => {
  it('formata data, dinheiro e lista de nomes do jeito brasileiro', () => {
    expect(formatarData('2026-11-20')).toBe('20/11/2026');
    expect(formatarDinheiro(1234.5)).toBe('R$ 1.234,50');
    expect(juntarNomes(['Bike'])).toBe('Bike');
    expect(juntarNomes(['Bike', 'Capacete'])).toBe('Bike e Capacete');
    expect(juntarNomes(['Bike', 'Capacete', 'Luvas'])).toBe('Bike, Capacete e Luvas');
  });

  it('aviso de multa usa "1 dia" no singular', () => {
    const texto = textoAvisoMulta({
      cliente: { nome: 'Bruno Lima', telefone: '21998765432' },
      multaId: 1,
      reservaId: 2,
      diasAtraso: 1,
      valor: 12
    });
    expect(texto).toBe(
      'Olá, Bruno. A reserva nº 2 foi devolvida com 1 dia de atraso e gerou uma multa de R$ 12,00. ' +
        'Em caso de dúvidas, fale com a loja.'
    );
  });
});
