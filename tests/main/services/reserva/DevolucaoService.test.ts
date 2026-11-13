import { describe, expect, it } from 'vitest';
import type { RegistrarDevolucaoDTO } from '../../../../src/shared/dto/devolucao.dto';
import { ValidacaoError } from '../../../../src/main/errors/ErroApp';
import { TransicaoInvalidaError } from '../../../../src/main/errors/ReservaErrors';
import { MultaPercentual } from '../../../../src/main/services/multa/MultaPercentual';
import { DevolucaoService } from '../../../../src/main/services/reserva/DevolucaoService';
import { cenarioReserva } from './cenario';

async function montar(hoje = '2026-11-25', ativa = true) {
  const c = await cenarioReserva({ ativa });
  const devolucao = new DevolucaoService(c.banco, new MultaPercentual(), () => hoje);
  const entrada = (extra: Partial<RegistrarDevolucaoDTO> = {}): RegistrarDevolucaoDTO => ({
    reservaId: c.reservaId,
    dataDevolucaoReal: '2026-11-22',
    itens: c.itens.map((i) => ({ itemReservaId: i.id, estadoDevolucao: 'MEDIO' as const })),
    ...extra
  });
  return { ...c, devolucao, entrada };
}

describe('DevolucaoService', () => {
  it('no prazo: DEVOLVIDA, itens com estado, equipamentos liberados e sem multa', async () => {
    const m = await montar();
    const r = await m.devolucao.registrar(m.entrada());
    expect(r.reserva).toMatchObject({ status: 'DEVOLVIDA', dataDevolucaoReal: '2026-11-22' });
    expect(r.multaGerada).toBeUndefined();
    expect(r.equipamentosLiberados.sort()).toEqual([m.bike.id, m.caiaque.id].sort());
    expect(m.banco.equip(m.bike.id)).toMatchObject({
      status: 'DISPONIVEL',
      estadoConservacao: 'MEDIO'
    });
    expect(r.reserva.itens.every((i) => i.estadoDevolucao === 'MEDIO')).toBe(true);
  });

  it('com atraso gera a multa pela estratégia (10% × soma das diárias × dias)', async () => {
    const m = await montar();
    const r = await m.devolucao.registrar(m.entrada({ dataDevolucaoReal: '2026-11-25' }));
    expect(r.multaGerada).toMatchObject({ diasAtraso: 3, valor: 40.5, quitada: false });
  });

  it('reterCaucao usa a caução JÁ PAGA para abater a multa, sem contar o dinheiro duas vezes', async () => {
    const m = await montar();
    m.banco.pagamento(m.reservaId, 81, 'CAUCAO', 'PIX');
    const r = await m.devolucao.registrar(
      m.entrada({ dataDevolucaoReal: '2026-11-25', reterCaucao: true })
    );
    expect(r.multaGerada).toMatchObject({ valor: 40.5, valorPago: 40.5, quitada: true });
    const pagamentos = m.banco.t.pagamentos.filter((p) => p.reservaId === m.reservaId);
    expect(pagamentos.map((p) => [p.tipo, p.forma, p.valor])).toEqual([
      ['CAUCAO', 'PIX', 40.5], // sobra da caução, continua retida
      ['MULTA', 'PIX', 40.5]
    ]);
    expect(r.reserva.totalPago).toBe(81); // o total recebido não mudou
  });

  it('caução não paga não abate nada', async () => {
    const m = await montar();
    const r = await m.devolucao.registrar(
      m.entrada({ dataDevolucaoReal: '2026-11-25', reterCaucao: true })
    );
    expect(r.multaGerada).toMatchObject({ valorPago: 0, quitada: false });
  });

  it('caução menor que a multa: usa toda a caução e a multa fica em aberto', async () => {
    const m = await montar();
    m.banco.pagamento(m.reservaId, 30, 'CAUCAO', 'DINHEIRO');
    const r = await m.devolucao.registrar(
      m.entrada({ dataDevolucaoReal: '2026-11-25', reterCaucao: true })
    );
    expect(r.multaGerada).toMatchObject({ valorPago: 30, quitada: false });
    expect(m.banco.t.pagamentos.some((p) => p.tipo === 'CAUCAO')).toBe(false);
  });

  it('exige o estado de todos os itens, sem repetir', async () => {
    const m = await montar();
    const [primeiro] = m.entrada().itens;
    await expect(m.devolucao.registrar(m.entrada({ itens: [primeiro!] }))).rejects.toThrow(
      'Informe o estado de cada equipamento da reserva'
    );
    await expect(
      m.devolucao.registrar(m.entrada({ itens: [primeiro!, primeiro!] }))
    ).rejects.toThrow(ValidacaoError);
  });

  it('data no futuro, reserva não retirada e erro no meio (rollback)', async () => {
    const m = await montar('2026-11-21');
    await expect(m.devolucao.registrar(m.entrada())).rejects.toThrow('não pode estar no futuro');

    const p = await montar('2026-11-25', false);
    await expect(p.devolucao.registrar(p.entrada())).rejects.toThrow(TransicaoInvalidaError);

    const r = await montar();
    r.banco.multa(r.reservaId, 10); // multa manual já existente
    await expect(
      r.devolucao.registrar(r.entrada({ dataDevolucaoReal: '2026-11-25' }))
    ).rejects.toThrow('já tem uma multa lançada à mão');
    expect(r.banco.reserva(r.reservaId).status).toBe('ATIVA');
    expect(r.banco.equip(r.bike.id).status).toBe('RESERVADO');
  });
});
