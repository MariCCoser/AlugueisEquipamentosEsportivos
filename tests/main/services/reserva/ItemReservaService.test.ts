import { beforeEach, describe, expect, it } from 'vitest';
import { NaoEncontradoError, RegraNegocioError } from '../../../../src/main/errors/DominioError';
import { EquipamentoIndisponivelError } from '../../../../src/main/errors/ReservaErrors';
import { MultaPercentual } from '../../../../src/main/services/multa/MultaPercentual';
import { ItemReservaService } from '../../../../src/main/services/reserva/ItemReservaService';
import { ReservaService } from '../../../../src/main/services/reserva/ReservaService';
import { BancoEmMemoria } from './BancoEmMemoria';

let banco: BancoEmMemoria;
let reservas: ReservaService;
let itens: ItemReservaService;
let reservaId: number;
let bike: number;
let caiaque: number;
let prancha: number;

beforeEach(async () => {
  banco = new BancoEmMemoria();
  reservas = new ReservaService(banco, new MultaPercentual(), () => '2026-11-13');
  itens = new ItemReservaService(banco);
  const clienteId = banco.cliente().id;
  bike = banco.equipamento({ nome: 'Bike', valorDiaria: 45 }).id;
  caiaque = banco.equipamento({ nome: 'Caiaque', valorDiaria: 90 }).id;
  prancha = banco.equipamento({ nome: 'Prancha', valorDiaria: 50 }).id;
  reservaId = (
    await reservas.criar(
      {
        clienteId,
        dataRetirada: '2026-11-20',
        dataDevolucaoPrevista: '2026-11-22',
        itens: [{ equipamentoId: bike }],
        valorCaucao: 0
      },
      1
    )
  ).id;
});

describe('ItemReservaService', () => {
  it('adiciona item e recalcula o total', async () => {
    const item = await itens.criar({ reservaId, equipamentoId: caiaque });
    expect(item).toMatchObject({ equipamentoNome: 'Caiaque', valorDiaria: 90 });
    expect(banco.reserva(reservaId).valorTotal).toBe(270); // (45 + 90) × 2
  });

  it('não adiciona equipamento repetido nem indisponível', async () => {
    await expect(itens.criar({ reservaId, equipamentoId: bike })).rejects.toThrow(
      'Este equipamento já está na reserva.'
    );
    banco.manutencaoAberta(caiaque);
    await expect(itens.criar({ reservaId, equipamentoId: caiaque })).rejects.toThrow(
      EquipamentoIndisponivelError
    );
  });

  it('troca o equipamento copiando a nova diária', async () => {
    const [item] = await itens.listarPorReserva({ reservaId });
    const trocado = await itens.atualizar({ id: item!.id, equipamentoId: prancha });
    expect(trocado).toMatchObject({ equipamentoNome: 'Prancha', valorDiaria: 50 });
    expect(banco.reserva(reservaId).valorTotal).toBe(100);
  });

  it('remove item, mas a reserva precisa ficar com pelo menos um', async () => {
    const novo = await itens.criar({ reservaId, equipamentoId: caiaque });
    await itens.excluir(novo.id);
    expect(banco.itensDa(reservaId)).toHaveLength(1);
    expect(banco.reserva(reservaId).valorTotal).toBe(90);

    const [ultimo] = banco.itensDa(reservaId);
    await expect(itens.excluir(ultimo!.id)).rejects.toThrow('pelo menos um equipamento');
  });

  it('só mexe em itens de reserva PENDENTE', async () => {
    await reservas.confirmarRetirada(reservaId);
    await expect(itens.criar({ reservaId, equipamentoId: caiaque })).rejects.toThrow(
      RegraNegocioError
    );
  });

  it('item ou reserva inexistentes', async () => {
    await expect(itens.buscarPorId(999)).rejects.toThrow(NaoEncontradoError);
    await expect(itens.listarPorReserva({ reservaId: 999 })).rejects.toThrow(NaoEncontradoError);
  });
});
