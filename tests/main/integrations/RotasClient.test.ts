import { describe, expect, it } from 'vitest';
import { IntegracaoError, NaoEncontradoError } from '../../../src/main/errors/ErroApp';
import { ClienteHttp } from '../../../src/main/integrations/ClienteHttp';
import { RotasClient, USER_AGENT } from '../../../src/main/integrations/RotasClient';
import { PoliticaOrigem } from '../../../src/main/security/PoliticaOrigem';
import { fetchFalso, respostaJson, urlDaChamada } from './apoio';

const LOJA = { latitude: -23.5648865, longitude: -46.651918 };
const CLIENTE = { latitude: -23.549905, longitude: -46.629818 };

function montar(...respostas: Parameters<typeof fetchFalso>) {
  const buscar = fetchFalso(...respostas);
  const nominatim = new ClienteHttp({
    nome: 'o serviço de mapas',
    cabecalhos: { 'User-Agent': USER_AGENT },
    buscar
  });
  const osrm = new ClienteHttp({ nome: 'o serviço de rotas', buscar });
  return { buscar, rotas: new RotasClient(nominatim, osrm) };
}

describe('RotasClient.localizar (Nominatim)', () => {
  it('devolve a coordenada do primeiro resultado e se identifica no User-Agent', async () => {
    const { rotas, buscar } = montar(respostaJson([{ lat: '-23.5648865', lon: '-46.6519180' }]));
    expect(await rotas.localizar(['Avenida Paulista, 1000, São Paulo - SP'])).toEqual(LOJA);

    const url = urlDaChamada(buscar);
    expect(url.hostname).toBe('nominatim.openstreetmap.org');
    expect(url.searchParams.get('q')).toBe('Avenida Paulista, 1000, São Paulo - SP');
    expect(url.searchParams.get('countrycodes')).toBe('br');
    expect(buscar.mock.calls[0]?.[1]?.headers).toMatchObject({ 'User-Agent': USER_AGENT });
  });

  it('não achou o endereço completo: tenta a próxima forma (sem número)', async () => {
    const { rotas, buscar } = montar(
      respostaJson([]),
      respostaJson([{ lat: '-23.55', lon: '-46.63' }])
    );
    expect(await rotas.localizar(['Rua Nova, 9999, SP', 'Rua Nova, São Paulo - SP'])).toEqual({
      latitude: -23.55,
      longitude: -46.63
    });
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it('nenhuma forma encontrada vira NaoEncontrado', async () => {
    const { rotas } = montar(respostaJson([]), respostaJson([]));
    await expect(rotas.localizar(['a', 'b'])).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  it('usa o cache (inclusive para endereço não encontrado)', async () => {
    const { rotas, buscar } = montar(respostaJson([]), respostaJson([{ lat: '1', lon: '2' }]));
    await rotas.localizar(['sem resultado', 'com resultado']);
    await rotas.localizar(['Sem Resultado', 'Com Resultado']);
    expect(buscar).toHaveBeenCalledTimes(2);
  });
});

describe('RotasClient.calcular (OSRM)', () => {
  it('converte metros/segundos em km (1 casa) e minutos, na ordem longitude,latitude', async () => {
    const { rotas, buscar } = montar(
      respostaJson({ code: 'Ok', routes: [{ distance: 3044.8, duration: 328.5 }] })
    );
    expect(await rotas.calcular(LOJA, CLIENTE)).toEqual({ distanciaKm: 3, duracaoMinutos: 5 });
    expect(urlDaChamada(buscar).pathname).toBe(
      '/route/v1/driving/-46.651918,-23.5648865;-46.629818,-23.549905'
    );
  });

  it('sem rota (ex.: ilha sem estrada) vira IntegracaoError', async () => {
    const { rotas } = montar(respostaJson({ code: 'NoRoute', routes: [] }));
    await expect(rotas.calcular(LOJA, CLIENTE)).rejects.toBeInstanceOf(IntegracaoError);
  });
});

describe('RotasClient.linkMapa', () => {
  it('gera link HTTPS do openstreetmap.org aceito pela PoliticaOrigem', () => {
    const link = RotasClient.linkMapa(LOJA, CLIENTE);
    expect(link).toBe(
      'https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=-23.5648865%2C-46.651918%3B-23.549905%2C-46.629818'
    );
    const politica = new PoliticaOrigem(undefined, '/app/index.html', [
      'openstreetmap.org',
      'google.com'
    ]);
    expect(politica.podeAbrirExterno(link)).toBe(true);
  });
});
