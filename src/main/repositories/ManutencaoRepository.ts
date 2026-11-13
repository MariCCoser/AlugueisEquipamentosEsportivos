import type { DataISO } from '@shared/dto/resposta';
import type { EstadoConservacao } from '@shared/models/enums';
import type { Manutencao, NovaManutencao } from '@shared/models/entidades';
import { BaseRepository, type CamposGravaveis } from './BaseRepository';

export interface RetornoManutencao {
  dataRetorno: DataISO;
  custo: number | null;
  estadoRetorno: EstadoConservacao;
}

/** Tabela `manutencoes`. "Em aberto" = ainda sem `data_retorno`. */
export class ManutencaoRepository extends BaseRepository<Manutencao, NovaManutencao> {
  protected readonly tabela = 'manutencoes';
  protected readonly campos: CamposGravaveis<NovaManutencao> = {
    equipamentoId: true,
    fornecedorId: true,
    tipo: true,
    descricao: true,
    dataEnvio: true,
    dataRetorno: true,
    custo: true,
    estadoRetorno: true
  };

  listarEmAberto(): Promise<Manutencao[]> {
    return this.selecionar('data_retorno IS NULL', [], 'ORDER BY data_envio, id');
  }

  listarPorEquipamento(equipamentoId: number): Promise<Manutencao[]> {
    return this.selecionar(
      'equipamento_id = ?',
      [equipamentoId],
      'ORDER BY data_envio DESC, id DESC'
    );
  }

  listarPorFornecedor(fornecedorId: number): Promise<Manutencao[]> {
    return this.selecionar(
      'fornecedor_id = ?',
      [fornecedorId],
      'ORDER BY data_envio DESC, id DESC'
    );
  }

  /** A manutenção em aberto do equipamento, se houver. */
  buscarEmAbertoDoEquipamento(equipamentoId: number): Promise<Manutencao | null> {
    return this.buscarUm('equipamento_id = ? AND data_retorno IS NULL', [equipamentoId]);
  }

  registrarRetorno(id: number, retorno: RetornoManutencao): Promise<Manutencao | null> {
    return this.atualizar(id, retorno);
  }
}
