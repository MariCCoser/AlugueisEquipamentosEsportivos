import { describe, expect, it } from 'vitest';
import { NaoEncontradoError, RegraNegocioError } from '../../../src/main/errors/ErroApp';
import { HistoricoClienteService } from '../../../src/main/services/HistoricoClienteService';
import { ManutencaoService } from '../../../src/main/services/ManutencaoService';
import { BancoEmMemoria } from './reserva/BancoEmMemoria';
import { cenarioReserva } from './reserva/cenario';

function montarManutencao() {
  const banco = new BancoEmMemoria();
  const service = new ManutencaoService(banco, () => '2026-11-13');
  const bike = banco.equipamento({ nome: 'Bike', estadoConservacao: 'REGULAR' });
  const oficina = banco.fornecedor('MANUTENCAO', { razaoSocial: 'Bike Reparos' });
  const loja = banco.fornecedor('COMPRA', { razaoSocial: 'Distribuidora' });
  const envio = {
    equipamentoId: bike.id,
    fornecedorId: oficina.id,
    tipo: 'CORRETIVA' as const,
    descricao: 'Troca da corrente',
    dataEnvio: '2026-11-10'
  };
  return { banco, service, bike, oficina, loja, envio };
}

describe('ManutencaoService', () => {
  it('envio: item fica EM_MANUTENCAO e o DTO traz os nomes', async () => {
    const m = montarManutencao();
    const dto = await m.service.criar(m.envio);
    expect(dto).toMatchObject({ equipamentoNome: 'Bike', fornecedorNome: 'Bike Reparos' });
    expect(dto.dataRetorno).toBeUndefined();
    expect(m.banco.equip(m.bike.id).status).toBe('EM_MANUTENCAO');
  });

  it('só prestador de MANUTENCAO, item fora de cliente e sem manutenção aberta', async () => {
    const m = montarManutencao();
    await expect(m.service.criar({ ...m.envio, fornecedorId: m.loja.id })).rejects.toThrow(
      'não prestador de manutenção'
    );
    m.banco.equip(m.bike.id).status = 'RESERVADO';
    await expect(m.service.criar(m.envio)).rejects.toThrow('está com um cliente');
    m.banco.equip(m.bike.id).status = 'DISPONIVEL';
    await m.service.criar(m.envio);
    await expect(m.service.criar(m.envio)).rejects.toThrow('já está em manutenção');
  });

  it('envio no futuro é recusado', async () => {
    const m = montarManutencao();
    await expect(m.service.criar({ ...m.envio, dataEnvio: '2026-11-14' })).rejects.toThrow(
      'não pode estar no futuro'
    );
  });

  it('retorno: grava custo e estado, item volta DISPONIVEL com a nova conservação', async () => {
    const m = montarManutencao();
    const { id } = await m.service.criar(m.envio);
    const dto = await m.service.registrarRetorno({
      id,
      dataRetorno: '2026-11-12',
      custo: 80,
      estadoRetorno: 'MUITO_BOM'
    });
    expect(dto).toMatchObject({ dataRetorno: '2026-11-12', custo: 80, estadoRetorno: 'MUITO_BOM' });
    expect(m.banco.equip(m.bike.id)).toMatchObject({
      status: 'DISPONIVEL',
      estadoConservacao: 'MUITO_BOM'
    });
    await expect(
      m.service.registrarRetorno({ id, dataRetorno: '2026-11-13', estadoRetorno: 'NOVO' })
    ).rejects.toThrow(RegraNegocioError);
  });

  it('retorno antes do envio é inválido', async () => {
    const m = montarManutencao();
    const { id } = await m.service.criar(m.envio);
    await expect(
      m.service.registrarRetorno({ id, dataRetorno: '2026-11-09', estadoRetorno: 'NOVO' })
    ).rejects.toThrow('antes do envio');
  });

  it('excluir lançamento aberto devolve o item para DISPONIVEL', async () => {
    const m = montarManutencao();
    const { id } = await m.service.criar(m.envio);
    await m.service.excluir(id);
    expect(m.banco.t.manutencoes).toHaveLength(0);
    expect(m.banco.equip(m.bike.id).status).toBe('DISPONIVEL');
  });

  it('listagens', async () => {
    const m = montarManutencao();
    await m.service.criar(m.envio);
    expect(await m.service.listarAbertas()).toHaveLength(1);
    expect(await m.service.listar({ abertas: false })).toHaveLength(0);
    expect(await m.service.listarPorEquipamento({ equipamentoId: m.bike.id })).toHaveLength(1);
    await expect(m.service.listarPorEquipamento({ equipamentoId: 999 })).rejects.toThrow(
      NaoEncontradoError
    );
  });
});

describe('HistoricoClienteService', () => {
  it('separa reservas ativas e anteriores, lista pagamentos e soma o que falta das multas', async () => {
    const c = await cenarioReserva();
    const anterior = await c.reservas.criar(
      {
        clienteId: c.cliente.id,
        dataRetirada: '2026-12-01',
        dataDevolucaoPrevista: '2026-12-02',
        itens: [{ equipamentoId: c.bike.id }],
        valorCaucao: 0
      },
      1
    );
    await c.reservas.cancelar({ id: anterior.id });
    c.banco.pagamento(c.reservaId, 100, 'ALUGUEL');
    const multa = c.banco.multa(c.reservaId, 40.5);
    c.banco.pagamento(c.reservaId, 10, 'MULTA', 'PIX', multa.id);

    const h = await new HistoricoClienteService(c.banco).historico(c.cliente.id);
    expect(h.cliente.cpfMascarado).toBe('***.982.247-**');
    expect(h.reservasAtivas.map((r) => r.id)).toEqual([c.reservaId]);
    expect(h.reservasAnteriores.map((r) => r.id)).toEqual([anterior.id]);
    expect(h.pagamentos).toHaveLength(2);
    expect(h.multasEmAberto).toHaveLength(1);
    expect(h.totalPendente).toBe(30.5);
  });

  it('cliente inexistente', async () => {
    await expect(new HistoricoClienteService(new BancoEmMemoria()).historico(9)).rejects.toThrow(
      NaoEncontradoError
    );
  });
});
