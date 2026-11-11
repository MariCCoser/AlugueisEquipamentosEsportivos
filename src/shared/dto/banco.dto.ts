export interface ContagemTabelaDTO {
  tabela: string;
  registros: number;
}

export type StatusBancoDTO =
  | { conectado: true; banco: string; tabelas: ContagemTabelaDTO[] }
  | { conectado: false; mensagem: string };
