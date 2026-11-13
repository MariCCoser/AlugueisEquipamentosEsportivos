/** Entrada de `notificacoes:enviarAvisoMulta`. */
export interface MultaIdDTO {
  multaId: number;
}

export type TipoNotificacao = 'LEMBRETE_DEVOLUCAO' | 'AVISO_MULTA';
export type CanalNotificacao = 'EMAIL' | 'WHATSAPP';

/** O que a nossa API de notificações responde depois de enviar. */
export interface NotificacaoDTO {
  /** Identificador gerado pela API. */
  id: string;
  tipo: TipoNotificacao;
  canal: CanalNotificacao;
  /** Para quem foi (e-mail ou telefone). */
  destinatario: string;
  enviadaEm: string;
  /** true = envio de teste (e-mail de teste / WhatsApp simulado). */
  simulada: boolean;
}
