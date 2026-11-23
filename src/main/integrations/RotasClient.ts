import { IntegracaoError, NaoEncontradoError } from '../errors/ErroApp';
import { CacheMemoria } from './CacheMemoria';
import type { ClienteHttp } from './ClienteHttp';
import type { Coordenada } from './ClimaClient';

/** Endereço não muda de lugar: guarda as coordenadas por 7 dias. */
const VALIDADE_ENDERECO_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * O Nominatim pede que todo programa se identifique no User-Agent (política de uso).
 * Sem dados pessoais: só o nome do sistema.
 */
export const USER_AGENT = 'LocadoraEsportiva/0.1 (projeto academico DAD)';

export interface TrechoRota {
  distanciaKm: number;
  duracaoMinutos: number;
}

type RespostaNominatim = { lat: string; lon: string }[];

interface RespostaOsrm {
  code?: string;
  routes?: { distance: number; duration: number }[];
}

/**
 * API 3 — rotas e mapas (OpenStreetMap, gratuito e sem chave).
 *
 * - Nominatim: transforma o endereço em latitude/longitude.
 * - OSRM: calcula distância e tempo de carro entre dois pontos.
 * - O link do mapa abre no openstreetmap.org, que está na lista de sites
 *   liberados da PoliticaOrigem (Pessoa 1).
 */
export class RotasClient {
  static readonly URL_NOMINATIM = 'https://nominatim.openstreetmap.org/search';
  static readonly URL_OSRM = 'https://router.project-osrm.org/route/v1/driving';

  constructor(
    private readonly nominatim: ClienteHttp,
    private readonly osrm: ClienteHttp,
    private readonly cache = new CacheMemoria<Coordenada>(VALIDADE_ENDERECO_MS)
  ) {}

  /**
   * Tenta o endereço completo e, se não achar, sem o número (ruas novas ou
   * numeração que o mapa não conhece). Não cai para "só a cidade": o centro da
   * cidade daria uma distância errada.
   */
  async localizar(tentativas: string[]): Promise<Coordenada> {
    for (const endereco of tentativas) {
      const achado = await this.cache.obterOuBuscar(endereco.toLowerCase(), async () => {
        const url = new URL(RotasClient.URL_NOMINATIM);
        url.search = new URLSearchParams({
          q: endereco,
          format: 'jsonv2',
          limit: '1',
          countrycodes: 'br'
        }).toString();
        const [primeiro] = await this.nominatim.obterJson<RespostaNominatim>(url.href);
        // Não achou: guarda NaN para não perguntar de novo o mesmo endereço
        return primeiro
          ? { latitude: Number(primeiro.lat), longitude: Number(primeiro.lon) }
          : { latitude: Number.NaN, longitude: Number.NaN };
      });
      if (Number.isFinite(achado.latitude) && Number.isFinite(achado.longitude)) return achado;
    }
    throw new NaoEncontradoError(
      'Não foi possível localizar esse endereço no mapa. Confira o cadastro do cliente.'
    );
  }

  async calcular(origem: Coordenada, destino: Coordenada): Promise<TrechoRota> {
    // O OSRM usa a ordem longitude,latitude
    const pontos = `${origem.longitude},${origem.latitude};${destino.longitude},${destino.latitude}`;
    const resposta = await this.osrm.obterJson<RespostaOsrm>(
      `${RotasClient.URL_OSRM}/${pontos}?overview=false`
    );
    const rota = resposta.code === 'Ok' ? resposta.routes?.[0] : undefined;
    if (!rota)
      throw new IntegracaoError('Não foi possível calcular uma rota de carro até o cliente.');
    return {
      distanciaKm: Math.round(rota.distance / 100) / 10, // 1 casa decimal
      duracaoMinutos: Math.max(1, Math.round(rota.duration / 60))
    };
  }

  /** Link HTTPS do openstreetmap.org com a rota de carro já traçada. */
  static linkMapa(origem: Coordenada, destino: Coordenada): string {
    const url = new URL('https://www.openstreetmap.org/directions');
    url.search = new URLSearchParams({
      engine: 'fossgis_osrm_car',
      route: `${origem.latitude},${origem.longitude};${destino.latitude},${destino.longitude}`
    }).toString();
    return url.href;
  }
}
