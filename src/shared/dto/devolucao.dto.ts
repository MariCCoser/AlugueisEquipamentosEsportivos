import type { EstadoConservacao } from '../models/enums';
import type { MultaDTO } from './multa.dto';
import type { ReservaDTO } from './reserva.dto';
import type { DataISO } from './resposta';

/** Como cada equipamento voltou. */
export interface ItemDevolucaoDTO {
  itemReservaId: number;
  estadoDevolucao: EstadoConservacao;
}

export interface RegistrarDevolucaoDTO {
  reservaId: number;
  dataDevolucaoReal: DataISO;
  /** Um para cada item da reserva. */
  itens: ItemDevolucaoDTO[];
  /** true = usa a caução para pagar a multa, se houver. */
  reterCaucao?: boolean;
}

export interface DevolucaoResultadoDTO {
  reserva: ReservaDTO;
  /** Não vem quando a devolução foi no prazo. */
  multaGerada?: MultaDTO;
  /** Equipamentos que voltaram a ficar disponíveis. */
  equipamentosLiberados: number[];
}
