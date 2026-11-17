import type { DataISO } from './resposta';

/** Uma linha da lista "Próximas devoluções" do painel. */
export interface ProximaDevolucaoDTO {
  reservaId: number;
  /** Nome do cliente (sem CPF: o painel não precisa dele). */
  cliente: string;
  dataPrevista: DataISO;
  /** 0 = no prazo; maior que 0 = atrasada há N dias. */
  diasAtraso: number;
}

/** Números da tela inicial depois do login. */
export interface DashboardResumoDTO {
  reservasAtivas: number;
  reservasAtrasadas: number;
  equipamentosEmManutencao: number;
  multasEmAberto: number;
  /** Soma do que ainda falta pagar das multas em aberto (desconta pagamentos parciais). */
  valorMultasEmAberto: number;
  /** Tudo o que entrou de pagamento neste mês. */
  faturamentoDoMes: number;
  /** Reservas ativas com devolução mais próxima (atrasadas primeiro). */
  proximasDevolucoes: ProximaDevolucaoDTO[];
}
