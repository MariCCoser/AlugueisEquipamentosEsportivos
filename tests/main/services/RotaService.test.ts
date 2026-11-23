import { describe, expect, it, vi } from 'vitest';
import { NaoEncontradoError } from '../../../src/main/errors/ErroApp';
import { RotasClient } from '../../../src/main/integrations/RotasClient';
import { RotaService } from '../../../src/main/services/integracoes/RotaService';
import { umCliente } from './dadosTeste';

const LOJA = { latitude: -23.56, longitude: -46.65 };
const CASA = { latitude: -23.55, longitude: -46.63 };

function montar() {
  const rotas = {
    localizar: vi.fn(async (tentativas: string[]) =>
      tentativas[0]?.startsWith('Loja') ? LOJA : CASA
    ),
    calcular: vi.fn(async () => ({ distanciaKm: 3, duracaoMinutos: 5 }))
  };
  const clientes = {
    buscarPorId: vi.fn(async (id: number) =>
      id === 1 ? umCliente({ complemento: 'Apto 52' }) : null
    )
  };
  const service = new RotaService(
    rotas,
    clientes,
    'Loja, Rua X, 10, São Paulo - SP',
    RotasClient.linkMapa
  );
  return { service, rotas };
}

describe('RotaService', () => {
  it('calcula a rota da loja até o cliente e monta o link do mapa', async () => {
    const { service, rotas } = montar();
    const rota = await service.calcular(1);
    expect(rota).toEqual({
      distanciaKm: 3,
      duracaoMinutos: 5,
      enderecoDestino: 'Avenida Paulista, 1000 - Bela Vista, São Paulo/SP',
      linkMapa: RotasClient.linkMapa(LOJA, CASA)
    });
    expect(rotas.calcular).toHaveBeenCalledWith(LOJA, CASA);
  });

  it('LGPD: para o mapa vai só o endereço (sem nome, CPF, telefone, e-mail ou complemento)', async () => {
    const { service, rotas } = montar();
    await service.calcular(1);
    const enviado = JSON.stringify(rotas.localizar.mock.calls);
    for (const pessoal of [
      'Ana Souza',
      '52998224725',
      '11987654321',
      'ana.souza@email.com',
      'Apto 52'
    ]) {
      expect(enviado).not.toContain(pessoal);
    }
    expect(rotas.localizar.mock.calls[1]?.[0]).toEqual([
      'Avenida Paulista, 1000, Bela Vista, São Paulo - SP, 01310-100',
      'Avenida Paulista, São Paulo - SP'
    ]);
  });

  it('cliente que não existe dá NaoEncontrado sem chamar o mapa', async () => {
    const { service, rotas } = montar();
    await expect(service.calcular(99)).rejects.toBeInstanceOf(NaoEncontradoError);
    expect(rotas.localizar).not.toHaveBeenCalled();
  });
});
