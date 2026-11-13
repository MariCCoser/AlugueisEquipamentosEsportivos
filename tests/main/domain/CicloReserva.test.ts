import { describe, expect, it } from 'vitest';
import { STATUS_RESERVA, type StatusReserva } from '@shared/models/enums';
import { CicloReserva } from '../../../src/main/domain/CicloReserva';
import { TransicaoInvalidaError } from '../../../src/main/errors/ReservaErrors';

const PERMITIDAS: [StatusReserva, StatusReserva][] = [
  ['PENDENTE', 'ATIVA'],
  ['PENDENTE', 'CANCELADA'],
  ['ATIVA', 'DEVOLVIDA'],
  ['ATIVA', 'CANCELADA']
];

describe('CicloReserva', () => {
  // Testa todas as 16 combinações de status: só as 4 permitidas passam
  for (const de of STATUS_RESERVA) {
    for (const para of STATUS_RESERVA) {
      const permitida = PERMITIDAS.some(([a, b]) => a === de && b === para);
      it(`${de} -> ${para} ${permitida ? 'é permitida' : 'é bloqueada'}`, () => {
        expect(CicloReserva.podeTransitar(de, para)).toBe(permitida);
        if (permitida) {
          expect(() => CicloReserva.validar(de, para)).not.toThrow();
        } else {
          expect(() => CicloReserva.validar(de, para)).toThrow(TransicaoInvalidaError);
        }
      });
    }
  }

  it('DEVOLVIDA e CANCELADA são finais', () => {
    expect(CicloReserva.ehFinal('DEVOLVIDA')).toBe(true);
    expect(CicloReserva.ehFinal('CANCELADA')).toBe(true);
    expect(CicloReserva.ehFinal('PENDENTE')).toBe(false);
  });

  it('só PENDENTE e ATIVA ocupam equipamentos', () => {
    expect(STATUS_RESERVA.filter((s) => CicloReserva.ocupaEquipamentos(s))).toEqual([
      'PENDENTE',
      'ATIVA'
    ]);
  });

  it('mensagem de erro é amigável', () => {
    expect(() => CicloReserva.validar('DEVOLVIDA', 'ATIVA')).toThrow(
      'Não é possível mudar a reserva de DEVOLVIDA para ATIVA.'
    );
  });
});
