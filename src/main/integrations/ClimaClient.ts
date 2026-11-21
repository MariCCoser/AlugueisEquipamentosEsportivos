import type { DataISO } from '@shared/dto/resposta';
import { IntegracaoError, NaoEncontradoError } from '../errors/ErroApp';
import { CacheMemoria } from './CacheMemoria';
import type { ClienteHttp } from './ClienteHttp';

/** Coordenadas de uma cidade não mudam: guarda por 7 dias. */
const VALIDADE_CIDADE_MS = 7 * 24 * 60 * 60 * 1000;
/** A previsão é atualizada algumas vezes por dia: guarda por 1 hora. */
const VALIDADE_PREVISAO_MS = 60 * 60 * 1000;

/** Nome de cada estado como o Open-Meteo devolve em `admin1`, para achar a cidade certa. */
export const ESTADOS: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins'
};

/** Códigos de tempo da OMM (WMO) usados pelo Open-Meteo, em português. */
const DESCRICOES: Record<number, string> = {
  0: 'Céu limpo',
  1: 'Predominantemente limpo',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Neblina',
  48: 'Neblina com geada',
  51: 'Garoa fraca',
  53: 'Garoa',
  55: 'Garoa forte',
  56: 'Garoa congelante',
  57: 'Garoa congelante forte',
  61: 'Chuva fraca',
  63: 'Chuva',
  65: 'Chuva forte',
  66: 'Chuva congelante',
  67: 'Chuva congelante forte',
  71: 'Neve fraca',
  73: 'Neve',
  75: 'Neve forte',
  77: 'Grãos de neve',
  80: 'Pancadas de chuva fracas',
  81: 'Pancadas de chuva',
  82: 'Pancadas de chuva fortes',
  85: 'Pancadas de neve',
  86: 'Pancadas de neve fortes',
  95: 'Tempestade',
  96: 'Tempestade com granizo',
  99: 'Tempestade com granizo forte'
};

export interface Coordenada {
  latitude: number;
  longitude: number;
}

/** Previsão de um dia, já em português e com números arredondados. */
export interface PrevisaoDia {
  data: DataISO;
  /** Código da OMM (WMO), ex.: 95 = tempestade. */
  codigoTempo: number;
  descricao: string;
  temperaturaMinima: number;
  temperaturaMaxima: number;
  /** De 0 a 100. */
  chanceDeChuva: number;
  ventoMaximoKmh: number;
}

interface RespostaGeocodificacao {
  results?: { latitude: number; longitude: number; admin1?: string; country_code?: string }[];
}

interface RespostaPrevisao {
  daily?: {
    time?: string[];
    weather_code?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    wind_speed_10m_max?: (number | null)[];
  };
}

/** Compara nomes sem acento e sem diferenciar maiúsculas ("Sao Paulo" = "São Paulo"). */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/**
 * API 2 — previsão do tempo (Open-Meteo, gratuita e sem chave).
 *
 * 1. Acha a latitude/longitude da cidade (API de geocodificação do Open-Meteo),
 *    escolhendo o resultado do estado certo (há várias "Florianópolis" no Brasil).
 * 2. Pede a previsão diária só do dia da retirada.
 */
export class ClimaClient {
  static readonly URL_GEOCODIFICACAO = 'https://geocoding-api.open-meteo.com/v1/search';
  static readonly URL_PREVISAO = 'https://api.open-meteo.com/v1/forecast';

  constructor(
    private readonly http: ClienteHttp,
    private readonly cacheCidades = new CacheMemoria<Coordenada>(VALIDADE_CIDADE_MS),
    private readonly cachePrevisoes = new CacheMemoria<PrevisaoDia>(VALIDADE_PREVISAO_MS)
  ) {}

  async previsao(cidade: string, uf: string, data: DataISO): Promise<PrevisaoDia> {
    const local = await this.localizar(cidade, uf);
    const chave = `${local.latitude},${local.longitude},${data}`;
    return this.cachePrevisoes.obterOuBuscar(chave, () => this.consultarPrevisao(local, data));
  }

  async localizar(cidade: string, uf: string): Promise<Coordenada> {
    const chave = `${normalizar(cidade)}|${uf.toUpperCase()}`;
    return this.cacheCidades.obterOuBuscar(chave, async () => {
      const url = new URL(ClimaClient.URL_GEOCODIFICACAO);
      url.search = new URLSearchParams({
        name: cidade.trim(),
        count: '10',
        language: 'pt',
        countryCode: 'BR',
        format: 'json'
      }).toString();
      const resposta = await this.http.obterJson<RespostaGeocodificacao>(url.href);

      const estado = ESTADOS[uf.toUpperCase()];
      const certo = resposta.results?.find(
        (r) =>
          estado !== undefined &&
          r.admin1 !== undefined &&
          normalizar(r.admin1) === normalizar(estado)
      );
      if (!certo) {
        throw new NaoEncontradoError(`Cidade ${cidade}/${uf} não encontrada no serviço de clima.`);
      }
      return { latitude: certo.latitude, longitude: certo.longitude };
    });
  }

  private async consultarPrevisao(local: Coordenada, data: DataISO): Promise<PrevisaoDia> {
    const url = new URL(ClimaClient.URL_PREVISAO);
    url.search = new URLSearchParams({
      latitude: String(local.latitude),
      longitude: String(local.longitude),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_probability_max',
        'wind_speed_10m_max'
      ].join(','),
      timezone: 'America/Sao_Paulo',
      start_date: data,
      end_date: data
    }).toString();
    const { daily } = await this.http.obterJson<RespostaPrevisao>(url.href);

    const indice = daily?.time?.indexOf(data) ?? -1;
    const codigo = daily?.weather_code?.[indice];
    if (!daily || indice < 0 || codigo === null || codigo === undefined) {
      throw new IntegracaoError('O serviço de clima não tem previsão para essa data.');
    }
    const numero = (lista?: (number | null)[]): number => Math.round(lista?.[indice] ?? 0);
    return {
      data,
      codigoTempo: codigo,
      descricao: DESCRICOES[codigo] ?? 'Tempo variável',
      temperaturaMinima: numero(daily.temperature_2m_min),
      temperaturaMaxima: numero(daily.temperature_2m_max),
      chanceDeChuva: numero(daily.precipitation_probability_max),
      ventoMaximoKmh: numero(daily.wind_speed_10m_max)
    };
  }
}
