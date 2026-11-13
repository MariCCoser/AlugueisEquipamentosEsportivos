import type { DataISO } from '@shared/dto/resposta';
import { ValidacaoError } from '../errors/ErroApp';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Operações com datas no formato 'YYYY-MM-DD' (o formato que trafega no IPC e
 * que o MySQL devolve com `dateStrings: true`).
 *
 * Tudo é feito em UTC e em dias inteiros, então horário de verão e fuso não
 * mudam a contagem de diárias nem de dias de atraso.
 */
export class CalendarioISO {
  /** Número do dia (dias desde 1970-01-01). Lança erro se a data não existir. */
  static paraNumeroDia(data: DataISO): number {
    const partes = FORMATO.exec(data);
    if (!partes) {
      throw new ValidacaoError(`Data "${data}" fora do formato AAAA-MM-DD.`);
    }
    const [ano, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
    const ms = Date.UTC(ano, mes - 1, dia);
    const conferencia = new Date(ms);
    // Date.UTC "corrige" datas impossíveis (31/02 vira 03/03); aqui isso é erro
    if (conferencia.getUTCMonth() !== mes - 1 || conferencia.getUTCDate() !== dia) {
      throw new ValidacaoError(`Data "${data}" não existe.`);
    }
    return ms / MS_POR_DIA;
  }

  static deNumeroDia(numeroDia: number): DataISO {
    return new Date(numeroDia * MS_POR_DIA).toISOString().slice(0, 10);
  }

  /** Dias de `inicio` até `fim` (negativo se `fim` vier antes). */
  static diasEntre(inicio: DataISO, fim: DataISO): number {
    return CalendarioISO.paraNumeroDia(fim) - CalendarioISO.paraNumeroDia(inicio);
  }

  static somarDias(data: DataISO, dias: number): DataISO {
    return CalendarioISO.deNumeroDia(CalendarioISO.paraNumeroDia(data) + dias);
  }

  static ehValida(data: string): boolean {
    try {
      CalendarioISO.paraNumeroDia(data);
      return true;
    } catch {
      return false;
    }
  }

  /** Data de hoje no fuso local do computador (é o "hoje" do balcão da loja). */
  static hoje(agora: Date = new Date()): DataISO {
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
}
