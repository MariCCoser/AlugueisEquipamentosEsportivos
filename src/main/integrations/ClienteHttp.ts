import { IntegracaoError } from '../errors/ErroApp';

/** Mesmo formato do `fetch` do Node; nos testes passamos uma versão de mentira. */
export type FuncaoFetch = typeof fetch;

/** Tempo padrão para uma API externa responder. */
export const TEMPO_LIMITE_PADRAO_MS = 8000;

export interface OpcoesClienteHttp {
  /** Nome que aparece nas mensagens, ex.: "o serviço de CEP". */
  nome: string;
  tempoLimiteMs?: number;
  /** Frase somada a toda mensagem de erro, ex.: "Preencha o endereço à mão." */
  dica?: string;
  /** Cabeçalhos fixos (ex.: User-Agent exigido pelo Nominatim). */
  cabecalhos?: Record<string, string>;
  buscar?: FuncaoFetch;
}

/**
 * GET de JSON numa API pública, usado pelos clientes de CEP, clima e rotas.
 *
 * - Desiste depois do tempo limite (AbortController), para a tela não ficar esperando.
 * - Qualquer problema (sem internet, demora, erro do servidor, limite de uso, resposta
 *   estranha) vira um `IntegracaoError` com uma frase amigável. O detalhe técnico
 *   não chega à tela.
 */
export class ClienteHttp {
  private readonly tempoLimiteMs: number;
  private readonly buscar: FuncaoFetch;

  constructor(private readonly opcoes: OpcoesClienteHttp) {
    this.tempoLimiteMs = opcoes.tempoLimiteMs ?? TEMPO_LIMITE_PADRAO_MS;
    this.buscar = opcoes.buscar ?? fetch;
  }

  async obterJson<T>(url: string): Promise<T> {
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), this.tempoLimiteMs);
    let resposta: Response;
    try {
      resposta = await this.buscar(url, {
        method: 'GET',
        headers: { Accept: 'application/json', ...this.opcoes.cabecalhos },
        signal: controle.signal
      });
    } catch {
      throw this.erro(
        controle.signal.aborted
          ? `${this.nomeMaiusculo()} demorou demais para responder.`
          : `Não foi possível falar com ${this.opcoes.nome}. Confira a internet.`
      );
    } finally {
      clearTimeout(relogio);
    }

    if (resposta.status === 429) {
      throw this.erro(`${this.nomeMaiusculo()} recebeu consultas demais agora. Tente mais tarde.`);
    }
    if (!resposta.ok) {
      throw this.erro(`${this.nomeMaiusculo()} está com problemas (código ${resposta.status}).`);
    }
    try {
      return (await resposta.json()) as T;
    } catch {
      throw this.erro(`${this.nomeMaiusculo()} devolveu uma resposta inválida.`);
    }
  }

  private erro(mensagem: string): IntegracaoError {
    return new IntegracaoError(this.opcoes.dica ? `${mensagem} ${this.opcoes.dica}` : mensagem);
  }

  private nomeMaiusculo(): string {
    return this.opcoes.nome.charAt(0).toUpperCase() + this.opcoes.nome.slice(1);
  }
}
