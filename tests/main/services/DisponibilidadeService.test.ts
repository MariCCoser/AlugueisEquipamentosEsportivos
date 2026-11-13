import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Equipamento, Manutencao } from '@shared/models/entidades';
import { Periodo } from '../../../src/main/domain/Periodo';
import { NaoEncontradoError, ValidacaoError } from '../../../src/main/errors/ErroApp';
import {
  DisponibilidadeService,
  type RepoReservasDisp
} from '../../../src/main/services/DisponibilidadeService';
import { umEquipamento } from './dadosTeste';

const periodo = { dataRetirada: '2026-11-20', dataDevolucaoPrevista: '2026-11-22' };

function montar(equipamento: Equipamento | null = umEquipamento()) {
  const equipamentos = { buscarPorId: vi.fn(async () => equipamento) };
  const manutencoes = {
    buscarEmAbertoDoEquipamento: vi.fn(async () => null as Manutencao | null)
  };
  const reservas = {
    equipamentoReservadoNoPeriodo: vi.fn<RepoReservasDisp['equipamentoReservadoNoPeriodo']>(
      async () => false
    )
  };
  return {
    equipamentos,
    manutencoes,
    reservas,
    service: new DisponibilidadeService(equipamentos, manutencoes, reservas)
  };
}

describe('DisponibilidadeService', () => {
  let m: ReturnType<typeof montar>;
  beforeEach(() => {
    m = montar();
  });

  it('item livre está disponível', async () => {
    expect(await m.service.verificar({ equipamentoId: 1, ...periodo })).toEqual({
      disponivel: true
    });
  });

  it('item de venda não é consultado no banco', async () => {
    m = montar(umEquipamento({ modalidade: 'VENDA', valorDiaria: null, precoVenda: 149.9 }));
    expect(await m.service.verificar({ equipamentoId: 1, ...periodo })).toEqual({
      disponivel: false,
      motivo: 'SOMENTE_VENDA'
    });
    expect(m.reservas.equipamentoReservadoNoPeriodo).not.toHaveBeenCalled();
  });

  it('manutenção em aberto bloqueia mesmo com status desatualizado', async () => {
    m.manutencoes.buscarEmAbertoDoEquipamento.mockResolvedValueOnce({ id: 9 } as Manutencao);
    const resultado = await m.service.verificar({ equipamentoId: 1, ...periodo });
    expect(resultado).toEqual({ disponivel: false, motivo: 'EM_MANUTENCAO' });
  });

  it('reserva no período bloqueia, repassando a reserva a ignorar', async () => {
    m.reservas.equipamentoReservadoNoPeriodo.mockResolvedValueOnce(true);
    const resultado = await m.service.verificar({
      equipamentoId: 1,
      ...periodo,
      ignorarReservaId: 5
    });
    expect(resultado).toEqual({ disponivel: false, motivo: 'RESERVADO_NO_PERIODO' });
    expect(m.reservas.equipamentoReservadoNoPeriodo).toHaveBeenCalledWith(
      1,
      '2026-11-20',
      '2026-11-22',
      5
    );
  });

  it('status RESERVADO sozinho não bloqueia outro período', async () => {
    m = montar(umEquipamento({ status: 'RESERVADO' }));
    expect((await m.service.verificar({ equipamentoId: 1, ...periodo })).disponivel).toBe(true);
  });

  it('equipamento inexistente e período invertido são erros', async () => {
    await expect(montar(null).service.verificar({ equipamentoId: 9, ...periodo })).rejects.toThrow(
      NaoEncontradoError
    );
    await expect(
      m.service.verificar({
        equipamentoId: 1,
        dataRetirada: '2026-11-22',
        dataDevolucaoPrevista: '2026-11-20'
      })
    ).rejects.toThrow(ValidacaoError);
  });

  it('filtrarDisponiveis mantém só os livres, na mesma ordem', async () => {
    const lista = [
      umEquipamento({ id: 1 }),
      umEquipamento({ id: 2, status: 'INDISPONIVEL' }),
      umEquipamento({ id: 3 }),
      umEquipamento({ id: 4 })
    ];
    m.reservas.equipamentoReservadoNoPeriodo.mockImplementation(async (id: number) => id === 3);
    const livres = await m.service.filtrarDisponiveis(
      lista,
      new Periodo(periodo.dataRetirada, periodo.dataDevolucaoPrevista)
    );
    expect(livres.map((e) => e.id)).toEqual([1, 4]);
  });
});
