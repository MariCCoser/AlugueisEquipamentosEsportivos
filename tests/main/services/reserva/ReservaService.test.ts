import { beforeEach, describe, expect, it } from 'vitest';
import type { CriarReservaDTO } from '../../../../src/shared/dto/reserva.dto';
import {
  NaoEncontradoError,
  RegraNegocioError,
  ValidacaoError
} from '../../../../src/main/errors/ErroApp';
import {
  EquipamentoIndisponivelError,
  TransicaoInvalidaError
} from '../../../../src/main/errors/ReservaErrors';
import { MultaPercentual } from '../../../../src/main/services/multa/MultaPercentual';
import { ReservaService } from '../../../../src/main/services/reserva/ReservaService';
import { BancoEmMemoria } from './BancoEmMemoria';

const HOJE = '2026-11-13';
const USUARIO = 2;

let banco: BancoEmMemoria;
let service: ReservaService;
let clienteId: number;
let bike: number;
let caiaque: number;

function pedido(extra: Partial<CriarReservaDTO> = {}): CriarReservaDTO {
  return {
    clienteId,
    dataRetirada: '2026-11-20',
    dataDevolucaoPrevista: '2026-11-22',
    itens: [{ equipamentoId: bike }, { equipamentoId: caiaque }],
    valorCaucao: 81,
    ...extra
  };
}

beforeEach(() => {
  banco = new BancoEmMemoria();
  service = new ReservaService(banco, new MultaPercentual(), () => HOJE);
  clienteId = banco.cliente().id;
  bike = banco.equipamento({ nome: 'Bike', valorDiaria: 45 }).id;
  caiaque = banco.equipamento({ nome: 'Caiaque', valorDiaria: 90 }).id;
});

describe('ReservaService.criar', () => {
  it('cria reserva PENDENTE com itens, diárias copiadas e usuário da sessão, numa transação', async () => {
    const r = await service.criar(pedido(), USUARIO);
    expect(banco.transacoes).toBe(1);
    expect(r).toMatchObject({
      status: 'PENDENTE',
      usuarioId: USUARIO,
      clienteNome: 'Ana Souza',
      valorTotal: 270, // (45 + 90) × 2 diárias
      valorCaucao: 81,
      caucaoStatus: 'RETIDA',
      totalPago: 0
    });
    expect(r.itens.map((i) => [i.equipamentoNome, i.valorDiaria])).toEqual([
      ['Bike', 45],
      ['Caiaque', 90]
    ]);
    // PENDENTE ainda não muda o status dos equipamentos
    expect(banco.equip(bike).status).toBe('DISPONIVEL');
  });

  it('a diária fica congelada mesmo se o preço mudar depois', async () => {
    const r = await service.criar(pedido(), USUARIO);
    banco.equip(bike).valorDiaria = 999;
    expect((await service.buscarPorId(r.id)).itens[0]?.valorDiaria).toBe(45);
  });

  it('recusa equipamento já reservado no período (bordas inclusivas)', async () => {
    await service.criar(pedido(), USUARIO);
    const conflito = pedido({
      dataRetirada: '2026-11-22', // começa no dia em que a outra devolve
      dataDevolucaoPrevista: '2026-11-25',
      itens: [{ equipamentoId: bike }]
    });
    await expect(service.criar(conflito, USUARIO)).rejects.toThrow(
      'O equipamento "Bike" já está reservado no período.'
    );
  });

  it('se um item falha, NADA é gravado (rollback)', async () => {
    banco.manutencaoAberta(caiaque);
    await expect(service.criar(pedido(), USUARIO)).rejects.toThrow(EquipamentoIndisponivelError);
    expect(banco.t.reservas).toHaveLength(0);
    expect(banco.t.itens).toHaveLength(0);
  });

  it('valida datas, repetidos, cliente e equipamento', async () => {
    await expect(service.criar(pedido({ dataRetirada: '2026-11-12' }), USUARIO)).rejects.toThrow(
      'A data de retirada não pode estar no passado.'
    );
    await expect(
      service.criar(pedido({ itens: [{ equipamentoId: bike }, { equipamentoId: bike }] }), USUARIO)
    ).rejects.toThrow(ValidacaoError);
    await expect(service.criar(pedido({ clienteId: 999 }), USUARIO)).rejects.toThrow(
      'Cliente não encontrado.'
    );
    await expect(
      service.criar(pedido({ itens: [{ equipamentoId: 999 }] }), USUARIO)
    ).rejects.toThrow(NaoEncontradoError);
  });

  it('item de venda não pode ser reservado', async () => {
    const bola = banco.equipamento({ modalidade: 'VENDA', valorDiaria: null, precoVenda: 150 });
    await expect(
      service.criar(pedido({ itens: [{ equipamentoId: bola.id }] }), USUARIO)
    ).rejects.toThrow('é somente para venda');
  });
});

describe('ReservaService.atualizar', () => {
  it('troca datas e itens, rechecando disponibilidade e recalculando o total', async () => {
    const r = await service.criar(pedido(), USUARIO);
    const nova = await service.atualizar({
      id: r.id,
      dataDevolucaoPrevista: '2026-11-25', // 5 diárias
      itens: [{ equipamentoId: bike }]
    });
    expect(nova.valorTotal).toBe(225);
    expect(nova.itens).toHaveLength(1);
  });

  it('não conflita com ela mesma ao mudar só as datas', async () => {
    const r = await service.criar(pedido(), USUARIO);
    await expect(
      service.atualizar({ id: r.id, dataRetirada: '2026-11-21' })
    ).resolves.toMatchObject({ valorTotal: 135 });
  });

  it('só reserva PENDENTE pode ser editada', async () => {
    const r = await service.criar(pedido(), USUARIO);
    await service.confirmarRetirada(r.id);
    await expect(service.atualizar({ id: r.id, observacoes: 'x' })).rejects.toThrow(
      'Só é possível editar reservas PENDENTES (esta está ATIVA).'
    );
  });
});

describe('ReservaService ciclo de status', () => {
  it('confirmarRetirada: ATIVA, equipamentos RESERVADO e estado de saída atualizado', async () => {
    const r = await service.criar(pedido(), USUARIO);
    banco.equip(bike).estadoConservacao = 'MEDIO'; // mudou entre a reserva e a retirada
    const ativa = await service.confirmarRetirada(r.id);
    expect(ativa.status).toBe('ATIVA');
    expect(banco.equip(bike).status).toBe('RESERVADO');
    expect(banco.equip(caiaque).status).toBe('RESERVADO');
    expect(ativa.itens.find((i) => i.equipamentoId === bike)?.estadoRetirada).toBe('MEDIO');
  });

  it('não entrega item que ainda está com outro cliente', async () => {
    const r = await service.criar(pedido(), USUARIO);
    banco.equip(bike).status = 'RESERVADO';
    await expect(service.confirmarRetirada(r.id)).rejects.toThrow(EquipamentoIndisponivelError);
    expect(banco.reserva(r.id).status).toBe('PENDENTE'); // rollback
  });

  it('não confirma duas vezes', async () => {
    const r = await service.criar(pedido(), USUARIO);
    await service.confirmarRetirada(r.id);
    await expect(service.confirmarRetirada(r.id)).rejects.toThrow(TransicaoInvalidaError);
  });

  it('cancelar ATIVA libera os equipamentos e guarda o motivo', async () => {
    const r = await service.criar(pedido({ observacoes: 'Cliente VIP' }), USUARIO);
    await service.confirmarRetirada(r.id);
    const cancelada = await service.cancelar({ id: r.id, motivo: 'Chuva' });
    expect(cancelada.status).toBe('CANCELADA');
    expect(cancelada.observacoes).toBe('Cliente VIP | Cancelada: Chuva');
    expect(banco.equip(bike).status).toBe('DISPONIVEL');
  });

  it('cancelada libera o período para outra reserva', async () => {
    const r = await service.criar(pedido(), USUARIO);
    await service.cancelar({ id: r.id });
    await expect(service.criar(pedido(), USUARIO)).resolves.toMatchObject({ status: 'PENDENTE' });
  });
});

describe('ReservaService.excluir', () => {
  it('exclui PENDENTE sem pagamentos (itens vão junto)', async () => {
    const r = await service.criar(pedido(), USUARIO);
    await service.excluir(r.id);
    expect(banco.t.reservas).toHaveLength(0);
    expect(banco.t.itens).toHaveLength(0);
  });

  it('com pagamento ou fora de PENDENTE, orienta cancelar', async () => {
    const r = await service.criar(pedido(), USUARIO);
    banco.pagamento(r.id, 50);
    await expect(service.excluir(r.id)).rejects.toThrow('cancele em vez de excluir');
    const r2 = await service.criar(
      pedido({ dataRetirada: '2026-12-01', dataDevolucaoPrevista: '2026-12-02' }),
      USUARIO
    );
    await service.confirmarRetirada(r2.id);
    await expect(service.excluir(r2.id)).rejects.toThrow(RegraNegocioError);
  });
});

describe('ReservaService listagens', () => {
  it('listar devolve resumos com nome do cliente, total pago e quantidade de itens', async () => {
    const r = await service.criar(pedido(), USUARIO);
    banco.pagamento(r.id, 100);
    const pagina = await service.listar({ status: 'PENDENTE' });
    expect(pagina.itens[0]).toMatchObject({
      clienteNome: 'Ana Souza',
      totalPago: 100,
      qtdItens: 2
    });
  });

  it('listarAtrasadas calcula dias de atraso e multa prevista (10%/dia)', async () => {
    const r = await service.criar(pedido(), USUARIO);
    await service.confirmarRetirada(r.id);
    const atrasado = new ReservaService(banco, new MultaPercentual(), () => '2026-11-25');
    const [item] = await atrasado.listarAtrasadas();
    expect(item).toMatchObject({ id: r.id, diasAtraso: 3, multaPrevista: 40.5 }); // 135 × 10% × 3
    expect(await service.listarAtivas()).toHaveLength(1);
  });
});

describe('ReservaService.observacoesComMotivo', () => {
  it('não passa de 255 caracteres', () => {
    expect(ReservaService.observacoesComMotivo('a'.repeat(250), 'motivo longo')).toHaveLength(255);
    expect(ReservaService.observacoesComMotivo(null, '  ')).toBeNull();
  });
});
