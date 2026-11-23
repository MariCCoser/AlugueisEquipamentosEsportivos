import { describe, expect, it, vi } from 'vitest';
import { RegraNegocioError } from '../../../src/main/errors/ErroApp';
import type { PrevisaoDia } from '../../../src/main/integrations/ClimaClient';
import { PrevisaoClimaService } from '../../../src/main/services/integracoes/PrevisaoClimaService';
import { umEquipamento, umaCategoria } from './dadosTeste';

const HOJE = '2026-11-20';

const TEMPESTADE: PrevisaoDia = {
  data: '2026-11-22',
  codigoTempo: 95,
  descricao: 'Tempestade',
  temperaturaMinima: 17,
  temperaturaMaxima: 25,
  chanceDeChuva: 90,
  ventoMaximoKmh: 45
};

const SOL: PrevisaoDia = {
  ...TEMPESTADE,
  codigoTempo: 0,
  descricao: 'Céu limpo',
  chanceDeChuva: 5,
  ventoMaximoKmh: 12
};

function montar(previsao: PrevisaoDia) {
  const equipamentos = [
    umEquipamento({ id: 1, categoriaId: 1 }), // Bicicletas (sensível)
    umEquipamento({ id: 2, nome: 'Caiaque', categoriaId: 2 }), // Caiaques (sensível)
    umEquipamento({ id: 3, nome: 'Raquete', categoriaId: 4 }), // Raquetes (não sensível)
    umEquipamento({ id: 4, nome: 'Bike urbana', categoriaId: 1 })
  ];
  const categorias = [
    umaCategoria({ id: 1, nome: 'Bicicletas', sensivelClima: true }),
    umaCategoria({ id: 2, nome: 'Caiaques e Canoas', sensivelClima: true }),
    umaCategoria({ id: 4, nome: 'Raquetes', sensivelClima: false })
  ];
  const clima = { previsao: vi.fn(async () => previsao) };
  const service = new PrevisaoClimaService(
    clima,
    {
      buscarPorIds: vi.fn(async (ids: number[]) => equipamentos.filter((e) => ids.includes(e.id)))
    },
    { buscarPorId: vi.fn(async (id: number) => categorias.find((c) => c.id === id) ?? null) },
    () => HOJE
  );
  return { service, clima };
}

const entrada = (equipamentoIds: number[], data = '2026-11-22') => ({
  cidade: 'Florianópolis',
  uf: 'SC',
  data,
  equipamentoIds
});

describe('PrevisaoClimaService', () => {
  it('tempestade + equipamentos sensíveis = alerta com as categorias (sem repetir)', async () => {
    const { service, clima } = montar(TEMPESTADE);
    const r = await service.prever(entrada([1, 2, 3, 4]));
    expect(clima.previsao).toHaveBeenCalledWith('Florianópolis', 'SC', '2026-11-22');
    expect(r).toMatchObject({
      cidade: 'Florianópolis',
      data: '2026-11-22',
      descricao: 'Tempestade',
      chanceDeChuva: 90,
      alerta: true,
      categoriasSensiveis: ['Bicicletas', 'Caiaques e Canoas']
    });
    expect(r.mensagemAlerta).toBe(
      'Previsão de tempestade, 90% de chance de chuva, ventos de até 45 km/h em Florianópolis na retirada. ' +
        'Confirme com o cliente o uso de: Bicicletas, Caiaques e Canoas.'
    );
  });

  it('tempo bom não gera alerta, mesmo com equipamento sensível', async () => {
    const { service } = montar(SOL);
    const r = await service.prever(entrada([1]));
    expect(r.alerta).toBe(false);
    expect(r).not.toHaveProperty('mensagemAlerta');
    expect(r.categoriasSensiveis).toEqual(['Bicicletas']);
  });

  it('tempo ruim sem equipamento sensível também não gera alerta', async () => {
    const { service } = montar(TEMPESTADE);
    const r = await service.prever(entrada([3]));
    expect(r.alerta).toBe(false);
    expect(r.categoriasSensiveis).toEqual([]);
  });

  it('só vento forte já é motivo de alerta', () => {
    expect(PrevisaoClimaService.motivosDeAlerta({ ...SOL, ventoMaximoKmh: 40 })).toEqual([
      'ventos de até 40 km/h'
    ]);
    expect(PrevisaoClimaService.motivosDeAlerta(SOL)).toEqual([]);
  });

  it('data no passado ou além de 15 dias é recusada sem chamar a API', async () => {
    const { service, clima } = montar(SOL);
    await expect(service.prever(entrada([1], '2026-11-19'))).rejects.toBeInstanceOf(
      RegraNegocioError
    );
    await expect(service.prever(entrada([1], '2026-12-06'))).rejects.toThrow(/15 dias/);
    expect(clima.previsao).not.toHaveBeenCalled();
    await expect(service.prever(entrada([1], '2026-12-05'))).resolves.toBeDefined();
  });
});
