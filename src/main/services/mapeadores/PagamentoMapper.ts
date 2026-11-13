import type { PagamentoDTO } from '@shared/dto/pagamento.dto';
import type { Pagamento } from '@shared/models/entidades';

/** Converte o registro do banco (`Pagamento`) no que trafega no IPC (`PagamentoDTO`). */
export class PagamentoMapper {
  static paraDTO(pagamento: Pagamento): PagamentoDTO {
    const dto: PagamentoDTO = {
      id: pagamento.id,
      reservaId: pagamento.reservaId,
      tipo: pagamento.tipo,
      forma: pagamento.forma,
      valor: pagamento.valor,
      data: pagamento.data
    };
    if (pagamento.multaId != null) dto.multaId = pagamento.multaId;
    return dto;
  }
}
