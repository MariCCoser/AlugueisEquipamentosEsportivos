/** Números da tela inicial depois do login. */
export interface DashboardResumoDTO {
  reservasAtivas: number;
  reservasAtrasadas: number;
  equipamentosEmManutencao: number;
  multasEmAberto: number;
  /** Soma das multas ainda não pagas. */
  valorMultasEmAberto: number;
  /** Tudo o que entrou de pagamento neste mês. */
  faturamentoDoMes: number;
}
