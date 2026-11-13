import { randomUUID } from 'node:crypto';
import type {
  CanalNotificacao,
  DestinatarioDTO,
  NotificacaoDTO,
  TipoNotificacao
} from '../../src/shared/dto/notificacao.dto';

export interface Envio {
  tipo: TipoNotificacao;
  destinatario: DestinatarioDTO;
  mensagem: string;
}

/**
 * Quem realmente entrega a mensagem. Hoje só existe a versão simulada;
 * para mandar de verdade (SMTP, API do WhatsApp...), basta criar outra classe
 * com o mesmo método `enviar` — o resto da API não muda.
 */
export interface Mensageiro {
  enviar(envio: Envio): Promise<NotificacaoDTO>;
}

/** E-mail se o cliente tiver; senão, WhatsApp pelo telefone. */
export function escolherCanal(destinatario: DestinatarioDTO): CanalNotificacao {
  return destinatario.email ? 'EMAIL' : 'WHATSAPP';
}

/**
 * Envio de teste: não manda nada para fora. Mostra a mensagem no terminal
 * e guarda as últimas enviadas, para conferir na apresentação (GET /notificacoes).
 */
export class MensageiroSimulado implements Mensageiro {
  private readonly enviadas: NotificacaoDTO[] = [];

  constructor(
    private readonly limiteHistorico = 100,
    private readonly mostrar: (texto: string) => void = (texto) => {
      process.stdout.write(`${texto}\n`);
    }
  ) {}

  async enviar({ tipo, destinatario, mensagem }: Envio): Promise<NotificacaoDTO> {
    const canal = escolherCanal(destinatario);
    const notificacao: NotificacaoDTO = {
      id: randomUUID(),
      tipo,
      canal,
      destinatario: canal === 'EMAIL' ? destinatario.email! : destinatario.telefone,
      mensagem,
      enviadaEm: new Date().toISOString(),
      simulada: true
    };

    this.mostrar(`[${canal} simulado] para ${notificacao.destinatario}: ${mensagem}`);
    this.enviadas.unshift(notificacao);
    this.enviadas.length = Math.min(this.enviadas.length, this.limiteHistorico);
    return notificacao;
  }

  /** As mais recentes primeiro. */
  historico(): NotificacaoDTO[] {
    return [...this.enviadas];
  }
}
