import { describe, expect, it } from 'vitest';
import { RegraNegocioError, ValidacaoError } from '../../../../src/main/errors/ErroApp';
import { MultaService } from '../../../../src/main/services/financeiro/MultaService';
import { PagamentoService } from '../../../../src/main/services/financeiro/PagamentoService';
import { MultaPercentual } from '../../../../src/main/services/multa/MultaPercentual';
import { cenarioReserva } from '../reserva/cenario';

async function montar() {
  const c = await cenarioReserva();
  return {
    ...c,
    pagamentos: new PagamentoService(c.banco),
    multas: new MultaService(c.banco, new MultaPercentual())
  };
}

describe('PagamentoService', () => {
  it('registra aluguel e caução até o valor combinado', async () => {
    const m = await montar();
    await m.pagamentos.criar({ reservaId: m.reservaId, tipo: 'ALUGUEL', forma: 'PIX', valor: 200 });
    await m.pagamentos.criar({
      reservaId: m.reservaId,
      tipo: 'ALUGUEL',
      forma: 'CARTAO',
      valor: 70
    });
    await expect(
      m.pagamentos.criar({ reservaId: m.reservaId, tipo: 'ALUGUEL', forma: 'PIX', valor: 1 })
    ).rejects.toThrow('Não há nada a pagar deste tipo.');
    await expect(
      m.pagamentos.criar({ reservaId: m.reservaId, tipo: 'CAUCAO', forma: 'PIX', valor: 90 })
    ).rejects.toThrow('O valor passa do que falta pagar');
  });

  it('tipo MULTA exige multaId da mesma reserva, e vice-versa', async () => {
    const m = await montar();
    await expect(
      m.pagamentos.criar({ reservaId: m.reservaId, tipo: 'MULTA', forma: 'PIX', valor: 10 })
    ).rejects.toThrow(ValidacaoError);
    await expect(
      m.pagamentos.criar({
        reservaId: m.reservaId,
        tipo: 'ALUGUEL',
        multaId: 5,
        forma: 'PIX',
        valor: 10
      })
    ).rejects.toThrow('Só pagamento do tipo MULTA');
    const outra = m.banco.multa(999, 50);
    await expect(
      m.pagamentos.criar({
        reservaId: m.reservaId,
        tipo: 'MULTA',
        multaId: outra.id,
        forma: 'PIX',
        valor: 10
      })
    ).rejects.toThrow('Multa não encontrada nesta reserva.');
  });

  it('pagamentos de multa quitam quando somam o valor; estorno reabre', async () => {
    const m = await montar();
    const multa = m.banco.multa(m.reservaId, 40.5);
    const pedido = { reservaId: m.reservaId, tipo: 'MULTA' as const, multaId: multa.id };
    await m.pagamentos.criar({ ...pedido, forma: 'PIX', valor: 20 });
    expect(m.banco.t.multas[0]!.quitada).toBe(false);
    const ultimo = await m.pagamentos.criar({ ...pedido, forma: 'DINHEIRO', valor: 20.5 });
    expect(m.banco.t.multas[0]!.quitada).toBe(true);

    await m.pagamentos.excluir(ultimo.id);
    expect(m.banco.t.multas[0]!.quitada).toBe(false);
  });

  it('correção de valor não pode passar do devido (descontando o próprio lançamento)', async () => {
    const m = await montar();
    const pg = await m.pagamentos.criar({
      reservaId: m.reservaId,
      tipo: 'ALUGUEL',
      forma: 'PIX',
      valor: 100
    });
    await expect(m.pagamentos.atualizar({ id: pg.id, valor: 270 })).resolves.toMatchObject({
      valor: 270
    });
    await expect(m.pagamentos.atualizar({ id: pg.id, valor: 271 })).rejects.toThrow(
      RegraNegocioError
    );
  });

  it('reserva cancelada não recebe pagamento', async () => {
    const m = await montar();
    await m.reservas.cancelar({ id: m.reservaId });
    await expect(
      m.pagamentos.criar({ reservaId: m.reservaId, tipo: 'ALUGUEL', forma: 'PIX', valor: 10 })
    ).rejects.toThrow('Reserva cancelada não recebe pagamentos.');
  });

  it('caução: só depois de terminar; devolver ou reter', async () => {
    const m = await montar();
    await expect(
      m.pagamentos.devolverCaucao({ reservaId: m.reservaId, reter: false })
    ).rejects.toThrow('só é resolvida depois da devolução');
    await m.reservas.cancelar({ id: m.reservaId });
    const retida = await m.pagamentos.devolverCaucao({ reservaId: m.reservaId, reter: true });
    expect(retida).toMatchObject({
      caucaoStatus: 'RETIDA',
      observacoes: 'Caução retida pela loja.'
    });
    const devolvida = await m.pagamentos.devolverCaucao({ reservaId: m.reservaId, reter: false });
    expect(devolvida.caucaoStatus).toBe('DEVOLVIDA');
    await expect(
      m.pagamentos.devolverCaucao({ reservaId: m.reservaId, reter: false })
    ).rejects.toThrow('não tem caução retida');
  });
});

describe('MultaService', () => {
  it('calcular simula sem gravar', async () => {
    const m = await montar();
    expect(
      await m.multas.calcular({ reservaId: m.reservaId, dataDevolucao: '2026-11-24' })
    ).toEqual({ diasAtraso: 2, valor: 27, estrategia: 'PERCENTUAL' });
    expect(m.banco.t.multas).toHaveLength(0);
  });

  it('lançamento manual: uma por reserva, com o nome do cliente', async () => {
    const m = await montar();
    const multa = await m.multas.criar({ reservaId: m.reservaId, diasAtraso: 1, valor: 15 });
    expect(multa).toMatchObject({ clienteNome: 'Ana Souza', valor: 15, valorPago: 0 });
    await expect(
      m.multas.criar({ reservaId: m.reservaId, diasAtraso: 1, valor: 15 })
    ).rejects.toThrow('já tem multa');
  });

  it('quitar paga só o saldo e marca quitada', async () => {
    const m = await montar();
    const multa = m.banco.multa(m.reservaId, 40.5);
    m.banco.pagamento(m.reservaId, 10, 'MULTA', 'PIX', multa.id);
    const quitada = await m.multas.quitar({ multaId: multa.id, forma: 'DINHEIRO' });
    expect(quitada).toMatchObject({ quitada: true, valorPago: 40.5 });
    const ultimo = m.banco.t.pagamentos.at(-1)!;
    expect([ultimo.tipo, ultimo.forma, ultimo.valor]).toEqual(['MULTA', 'DINHEIRO', 30.5]);
    await expect(m.multas.quitar({ multaId: multa.id, forma: 'PIX' })).rejects.toThrow(
      'já está quitada'
    );
  });

  it('correção e exclusão respeitam o que já foi pago', async () => {
    const m = await montar();
    const multa = m.banco.multa(m.reservaId, 40);
    m.banco.pagamento(m.reservaId, 25, 'MULTA', 'PIX', multa.id);
    await expect(m.multas.atualizar({ id: multa.id, valor: 20 })).rejects.toThrow(
      'menor que o já pago'
    );
    await expect(m.multas.atualizar({ id: multa.id, valor: 25 })).resolves.toMatchObject({
      quitada: true // baixou para exatamente o que foi pago
    });
    await expect(m.multas.excluir(multa.id)).rejects.toThrow('Estorne-os antes');
  });

  it('listar e listarEmAberto', async () => {
    const m = await montar();
    m.banco.multa(m.reservaId, 40);
    expect(await m.multas.listarEmAberto()).toHaveLength(1);
    expect(await m.multas.listar({ quitada: true })).toHaveLength(0);
  });
});
