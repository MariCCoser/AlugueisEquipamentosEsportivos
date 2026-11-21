import { describe, expect, it } from 'vitest';
import { IntegracaoError, NaoEncontradoError } from '../../../src/main/errors/ErroApp';
import { ClienteHttp } from '../../../src/main/integrations/ClienteHttp';
import { ClimaClient } from '../../../src/main/integrations/ClimaClient';
import { fetchFalso, respostaJson, urlDaChamada } from './apoio';

/** Resposta da geocodificação para "Florianópolis" (resumida): há uma em SC e uma no AC. */
const GEO_FLORIPA = {
  results: [
    {
      name: 'Florianópolis',
      latitude: -7.91667,
      longitude: -73.2,
      admin1: 'Acre',
      country_code: 'BR'
    },
    {
      name: 'Florianópolis',
      latitude: -27.59667,
      longitude: -48.54917,
      admin1: 'Santa Catarina',
      country_code: 'BR'
    }
  ]
};

function previsaoDoDia(data: string, extra: Record<string, number | null> = {}) {
  return {
    daily: {
      time: [data],
      weather_code: [extra['codigo'] ?? 95],
      temperature_2m_max: [24.6],
      temperature_2m_min: [17.2],
      precipitation_probability_max: [extra['chuva'] === undefined ? 90 : extra['chuva']],
      wind_speed_10m_max: [42.4]
    }
  };
}

function montar(...respostas: Parameters<typeof fetchFalso>) {
  const buscar = fetchFalso(...respostas);
  return {
    buscar,
    clima: new ClimaClient(new ClienteHttp({ nome: 'o serviço de clima', buscar }))
  };
}

describe('ClimaClient', () => {
  it('acha a cidade do estado certo e devolve a previsão em português', async () => {
    const { clima, buscar } = montar(
      respostaJson(GEO_FLORIPA),
      respostaJson(previsaoDoDia('2026-11-22'))
    );
    expect(await clima.previsao('Florianópolis', 'SC', '2026-11-22')).toEqual({
      data: '2026-11-22',
      codigoTempo: 95,
      descricao: 'Tempestade',
      temperaturaMinima: 17,
      temperaturaMaxima: 25,
      chanceDeChuva: 90,
      ventoMaximoKmh: 42
    });

    const geo = urlDaChamada(buscar, 0);
    expect(geo.searchParams.get('name')).toBe('Florianópolis');
    expect(geo.searchParams.get('countryCode')).toBe('BR');

    const previsao = urlDaChamada(buscar, 1);
    expect(previsao.searchParams.get('latitude')).toBe('-27.59667'); // a de SC, não a do Acre
    expect(previsao.searchParams.get('start_date')).toBe('2026-11-22');
    expect(previsao.searchParams.get('end_date')).toBe('2026-11-22');
  });

  it('acha o estado mesmo com a cidade escrita sem acento', async () => {
    const { clima } = montar(
      respostaJson({ results: [{ latitude: -23.55, longitude: -46.63, admin1: 'Sao Paulo' }] }),
      respostaJson(previsaoDoDia('2026-11-22', { codigo: 0, chuva: 5 }))
    );
    expect((await clima.previsao('Sao Paulo', 'SP', '2026-11-22')).descricao).toBe('Céu limpo');
  });

  it('cidade que não existe no estado vira NaoEncontrado', async () => {
    const { clima } = montar(respostaJson(GEO_FLORIPA));
    await expect(clima.previsao('Florianópolis', 'MG', '2026-11-22')).rejects.toBeInstanceOf(
      NaoEncontradoError
    );
  });

  it('sem chance de chuva informada, considera 0%', async () => {
    const { clima } = montar(
      respostaJson(GEO_FLORIPA),
      respostaJson(previsaoDoDia('2026-11-22', { codigo: 2, chuva: null }))
    );
    expect((await clima.previsao('Florianópolis', 'SC', '2026-11-22')).chanceDeChuva).toBe(0);
  });

  it('resposta sem o dia pedido vira IntegracaoError', async () => {
    const { clima } = montar(respostaJson(GEO_FLORIPA), respostaJson({ daily: { time: [] } }));
    await expect(clima.previsao('Florianópolis', 'SC', '2026-11-22')).rejects.toBeInstanceOf(
      IntegracaoError
    );
  });

  it('limite diário do Open-Meteo (429) vira mensagem amigável', async () => {
    const { clima } = montar(
      respostaJson(GEO_FLORIPA),
      respostaJson({ error: true, reason: 'Daily API request limit exceeded.' }, 429)
    );
    await expect(clima.previsao('Florianópolis', 'SC', '2026-11-22')).rejects.toThrow(
      /consultas demais/
    );
  });

  it('usa o cache para a cidade e para a previsão do mesmo dia', async () => {
    const { clima, buscar } = montar(
      respostaJson(GEO_FLORIPA),
      respostaJson(previsaoDoDia('2026-11-22'))
    );
    await clima.previsao('Florianópolis', 'SC', '2026-11-22');
    await clima.previsao('florianopolis ', 'sc', '2026-11-22');
    expect(buscar).toHaveBeenCalledTimes(2);
  });
});
