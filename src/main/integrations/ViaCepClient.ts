import type { EnderecoDTO } from '@shared/dto/integracao.dto';
import { NaoEncontradoError, ValidacaoError } from '../errors/ErroApp';
import { CacheMemoria } from './CacheMemoria';
import type { ClienteHttp } from './ClienteHttp';

/** Endereço de um CEP muda muito raramente: guarda por 1 dia. */
const VALIDADE_CACHE_MS = 24 * 60 * 60 * 1000;

export const MSG_CEP_NAO_ENCONTRADO =
  'CEP não encontrado. Confira os números ou preencha o endereço à mão.';

/** Formato da resposta do ViaCEP (https://viacep.com.br). */
interface RespostaViaCep {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  /** O ViaCEP responde `{ "erro": true }` (ou "true") quando o CEP não existe. */
  erro?: boolean | string;
}

/**
 * API 1 — CEP (ViaCEP, gratuita e sem chave).
 * Preenche rua, bairro, cidade e UF no cadastro de cliente.
 *
 * Se o CEP não existir ou a internet falhar, a tela mostra a mensagem embaixo do campo
 * CEP e a pessoa continua podendo digitar o endereço à mão.
 * O complemento do ViaCEP não é usado: é a faixa de números da rua, não o do cliente.
 */
export class ViaCepClient {
  static readonly URL_BASE = 'https://viacep.com.br/ws';

  constructor(
    private readonly http: ClienteHttp,
    private readonly cache = new CacheMemoria<EnderecoDTO>(VALIDADE_CACHE_MS)
  ) {}

  async buscar(cep: string): Promise<EnderecoDTO> {
    const digitos = cep.replace(/\D/g, '');
    if (!/^\d{8}$/.test(digitos)) {
      throw new ValidacaoError('CEP inválido.', { cep: 'CEP deve ter 8 dígitos.' });
    }
    return this.cache.obterOuBuscar(digitos, () => this.consultar(digitos));
  }

  private async consultar(cep: string): Promise<EnderecoDTO> {
    const resposta = await this.http.obterJson<RespostaViaCep>(
      `${ViaCepClient.URL_BASE}/${cep}/json/`
    );
    if (!resposta || resposta.erro === true || resposta.erro === 'true' || !resposta.uf) {
      throw new NaoEncontradoError(MSG_CEP_NAO_ENCONTRADO);
    }
    return {
      cep,
      // CEP geral de cidade pequena vem sem rua e bairro: a pessoa completa à mão
      rua: resposta.logradouro?.trim() ?? '',
      bairro: resposta.bairro?.trim() ?? '',
      cidade: resposta.localidade?.trim() ?? '',
      uf: resposta.uf.trim().toUpperCase()
    };
  }
}
