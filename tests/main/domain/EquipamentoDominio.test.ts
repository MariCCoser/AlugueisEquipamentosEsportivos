import { describe, expect, it } from 'vitest';
import {
  EquipamentoDominio,
  type DadosEquipamento
} from '../../../src/main/domain/EquipamentoDominio';
import { ValidacaoError } from '../../../src/main/errors/ErroApp';
import { EquipamentoIndisponivelError } from '../../../src/main/errors/ReservaErrors';

const bike: DadosEquipamento = {
  id: 1,
  nome: 'Mountain Bike Aro 29',
  modalidade: 'LOCACAO',
  estadoConservacao: 'MUITO_BOM',
  status: 'DISPONIVEL',
  valorDiaria: 45,
  precoVenda: null
};

const bola: DadosEquipamento = {
  ...bike,
  id: 12,
  nome: 'Bola de Futebol Oficial',
  modalidade: 'VENDA',
  valorDiaria: null,
  precoVenda: 149.9
};

describe('EquipamentoDominio', () => {
  it('locação exige diária e venda exige preço', () => {
    expect(() => new EquipamentoDominio({ ...bike, valorDiaria: null })).toThrow(ValidacaoError);
    expect(() => new EquipamentoDominio({ ...bike, valorDiaria: 0 })).toThrow(ValidacaoError);
    expect(() => new EquipamentoDominio({ ...bola, precoVenda: null })).toThrow(ValidacaoError);
  });

  it('devolve a diária como Dinheiro', () => {
    expect(new EquipamentoDominio(bike).diaria().emReais()).toBe(45);
  });

  it('item de venda não tem diária nem pode ser reservado', () => {
    const item = new EquipamentoDominio(bola);
    expect(() => item.diaria()).toThrow(EquipamentoIndisponivelError);
    expect(item.impedimentoParaReserva()).toBe('SOMENTE_VENDA');
  });

  it.each([
    ['DISPONIVEL', null],
    ['RESERVADO', null], // pode estar livre em outro período
    ['EM_MANUTENCAO', 'EM_MANUTENCAO'],
    ['INDISPONIVEL', 'INDISPONIVEL']
  ] as const)('status %s -> impedimento %s', (status, esperado) => {
    expect(new EquipamentoDominio({ ...bike, status }).impedimentoParaReserva()).toBe(esperado);
  });

  it('garantirReservavel lança erro com o nome do item', () => {
    const item = new EquipamentoDominio({ ...bike, status: 'EM_MANUTENCAO' });
    expect(() => item.garantirReservavel()).toThrow(
      'O equipamento "Mountain Bike Aro 29" está em manutenção.'
    );
  });
});
