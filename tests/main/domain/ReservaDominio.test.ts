import { describe, expect, it } from 'vitest';
import { Dinheiro } from '../../../src/main/domain/Dinheiro';
import { Periodo } from '../../../src/main/domain/Periodo';
import { ReservaDominio, type ItemDaReserva } from '../../../src/main/domain/ReservaDominio';
import { RegraNegocioError, ValidacaoError } from '../../../src/main/errors/ErroApp';
import { TransicaoInvalidaError } from '../../../src/main/errors/ReservaErrors';

const itens: ItemDaReserva[] = [
  { equipamentoId: 1, diaria: Dinheiro.deReais(45) },
  { equipamentoId: 4, diaria: Dinheiro.deReais(90) }
];
const periodo = new Periodo('2026-11-10', '2026-11-12'); // 2 diárias

function novaReserva(caucao = 0): ReservaDominio {
  return ReservaDominio.nova(periodo, itens, Dinheiro.deReais(caucao));
}

describe('ReservaDominio', () => {
  describe('criação', () => {
    it('nasce PENDENTE', () => {
      expect(novaReserva().status).toBe('PENDENTE');
    });

    it('calcula soma das diárias e valor total', () => {
      const reserva = novaReserva();
      expect(reserva.somaDiarias().emReais()).toBe(135);
      expect(reserva.valorTotal().emReais()).toBe(270); // 135 × 2
    });

    it('caução sugerida é 30% do total', () => {
      expect(ReservaDominio.caucaoSugerida(Dinheiro.deReais(270)).emReais()).toBe(81);
    });

    it('caução zero = NAO_APLICAVEL; com valor = RETIDA', () => {
      expect(novaReserva(0).caucaoStatus).toBe('NAO_APLICAVEL');
      expect(novaReserva(81).caucaoStatus).toBe('RETIDA');
    });

    it('exige pelo menos um item, sem repetir equipamento', () => {
      expect(() => ReservaDominio.nova(periodo, [], Dinheiro.ZERO)).toThrow(ValidacaoError);
      expect(() => ReservaDominio.nova(periodo, [itens[0]!, itens[0]!], Dinheiro.ZERO)).toThrow(
        ValidacaoError
      );
    });

    it('caução negativa é inválida', () => {
      expect(() => novaReserva(-1)).toThrow(ValidacaoError);
    });
  });

  describe('ciclo de vida', () => {
    it('PENDENTE -> ATIVA -> DEVOLVIDA no prazo, sem atraso', () => {
      const reserva = novaReserva();
      expect(reserva.podeSerEditada()).toBe(true);
      reserva.confirmarRetirada();
      expect(reserva.status).toBe('ATIVA');
      expect(reserva.podeSerEditada()).toBe(false);
      expect(reserva.registrarDevolucao('2026-11-12')).toBe(0);
      expect(reserva.status).toBe('DEVOLVIDA');
      expect(reserva.dataDevolucaoReal).toBe('2026-11-12');
    });

    it('devolução atrasada devolve os dias de atraso', () => {
      const reserva = novaReserva();
      reserva.confirmarRetirada();
      expect(reserva.registrarDevolucao('2026-11-15')).toBe(3);
    });

    it('não devolve reserva que ainda não foi retirada', () => {
      expect(() => novaReserva().registrarDevolucao('2026-11-12')).toThrow(TransicaoInvalidaError);
    });

    it('não aceita devolução antes da retirada', () => {
      const reserva = novaReserva();
      reserva.confirmarRetirada();
      expect(() => reserva.registrarDevolucao('2026-11-09')).toThrow(RegraNegocioError);
      expect(reserva.status).toBe('ATIVA'); // nada mudou
    });

    it('cancelada não pode ser reativada', () => {
      const reserva = novaReserva();
      reserva.cancelar();
      expect(() => reserva.confirmarRetirada()).toThrow(TransicaoInvalidaError);
    });
  });

  it('está atrasada só se ATIVA e com prazo vencido', () => {
    const reserva = novaReserva();
    expect(reserva.estaAtrasada('2026-11-20')).toBe(false); // ainda PENDENTE
    reserva.confirmarRetirada();
    expect(reserva.estaAtrasada('2026-11-12')).toBe(false);
    expect(reserva.estaAtrasada('2026-11-13')).toBe(true);
  });

  it('restaurar reconstrói uma reserva do banco', () => {
    const reserva = ReservaDominio.restaurar({
      status: 'ATIVA',
      periodo,
      itens,
      valorCaucao: Dinheiro.ZERO,
      caucaoStatus: 'NAO_APLICAVEL'
    });
    expect(reserva.registrarDevolucao('2026-11-13')).toBe(1);
  });
});
