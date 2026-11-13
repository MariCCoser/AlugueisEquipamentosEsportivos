import type {
  NotificacaoDTO,
  PedidoAvisoMultaDTO,
  PedidoLembreteDTO
} from '@shared/dto/notificacao.dto';
import type { ConfigNotificacoes } from '../config/Configuracao';
import { IntegracaoError } from '../errors/ErroApp';

/** Mesmo formato do `fetch` do Node; nos testes passamos uma versão de mentira. */
export type FuncaoFetch = typeof fetch;

/**
 * Conversa com a nossa API de notificações (pasta `api-notificacoes/`).
 *
 * Qualquer problema (API desligada, demora, chave errada...) vira um `IntegracaoError`
 * com uma mensagem que pode ser mostrada na tela — o app nunca trava por causa disso.
 */
export class NotificacaoClient {
  constructor(
    private readonly config: ConfigNotificacoes,
    private readonly buscar: FuncaoFetch = fetch
  ) {}

  enviarLembrete(pedido: PedidoLembreteDTO): Promise<NotificacaoDTO> {
    return this.postar('/notificacoes/lembrete-devolucao', pedido);
  }

  enviarAvisoMulta(pedido: PedidoAvisoMultaDTO): Promise<NotificacaoDTO> {
    return this.postar('/notificacoes/aviso-multa', pedido);
  }

  private async postar(caminho: string, corpo: object): Promise<NotificacaoDTO> {
    let resposta: Response;
    try {
      resposta = await this.buscar(`${this.config.url}${caminho}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.chave}`
        },
        body: JSON.stringify(corpo),
        // Desiste se a API não responder a tempo
        signal: AbortSignal.timeout(this.config.tempoLimiteMs)
      });
    } catch (erro) {
      const demorou = erro instanceof Error && erro.name === 'TimeoutError';
      throw new IntegracaoError(
        demorou
          ? 'A API de notificações demorou demais para responder. Tente novamente.'
          : 'Não foi possível falar com a API de notificações. Ela está ligada? (npm run api:notificacoes)'
      );
    }

    if (!resposta.ok) {
      throw new IntegracaoError(await this.explicarFalha(resposta));
    }
    return (await resposta.json()) as NotificacaoDTO;
  }

  /** Transforma a resposta de erro da API numa frase para a tela. */
  private async explicarFalha(resposta: Response): Promise<string> {
    if (resposta.status === 401) {
      return 'A API de notificações recusou a chave de acesso. Confira NOTIFICACOES_CHAVE no .env.';
    }
    const corpo = (await resposta.json().catch(() => null)) as { erro?: unknown } | null;
    if (resposta.status === 400 && typeof corpo?.erro === 'string') {
      return `A API de notificações recusou os dados: ${corpo.erro}`;
    }
    return `A API de notificações falhou (código ${resposta.status}). Tente novamente.`;
  }
}
