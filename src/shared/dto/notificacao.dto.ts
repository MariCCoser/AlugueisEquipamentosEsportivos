import type { DataISO } from './resposta';

// ---------- tela -> Main (canais IPC) ----------

/** Entrada de `notificacoes:enviarAvisoMulta`. (O lembrete usa `ReservaIdDTO`.) */
export interface MultaIdDTO {
  multaId: number;
}

// ---------- Main -> nossa API de notificações (HTTP) ----------

/** Para quem a mensagem vai. Se tiver e-mail, vai por e-mail; se não, por WhatsApp. */
export interface DestinatarioDTO {
  nome: string;
  email?: string;
  /** Só dígitos, com DDD. */
  telefone: string;
}

/** Corpo do POST /notificacoes/lembrete-devolucao. */
export interface PedidoLembreteDTO {
  cliente: DestinatarioDTO;
  reservaId: number;
  dataDevolucaoPrevista: DataISO;
  /** Nomes dos equipamentos que precisam voltar. */
  equipamentos: string[];
}

/** Corpo do POST /notificacoes/aviso-multa. */
export interface PedidoAvisoMultaDTO {
  cliente: DestinatarioDTO;
  multaId: number;
  reservaId: number;
  diasAtraso: number;
  valor: number;
}

// ---------- resposta da API (volta até a tela) ----------

export type TipoNotificacao = 'LEMBRETE_DEVOLUCAO' | 'AVISO_MULTA';
export type CanalNotificacao = 'EMAIL' | 'WHATSAPP';

/** O que a nossa API responde depois de enviar. */
export interface NotificacaoDTO {
  /** Identificador gerado pela API. */
  id: string;
  tipo: TipoNotificacao;
  canal: CanalNotificacao;
  /** Para quem foi (e-mail ou telefone). */
  destinatario: string;
  /** O texto que foi enviado. */
  mensagem: string;
  enviadaEm: string;
  /** true = envio de teste (nada sai de verdade para o cliente). */
  simulada: boolean;
}
