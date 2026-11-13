import type { Modalidade, StatusEquipamento } from '@shared/models/enums';
import type { Equipamento, NovoEquipamento } from '@shared/models/entidades';
import { BaseRepository, escaparLike, type CamposGravaveis } from './BaseRepository';

export interface FiltroEquipamentos {
  status?: StatusEquipamento;
  modalidade?: Modalidade;
  categoriaId?: number;
  /** Parte do nome. */
  nome?: string;
}

/** Tabela `equipamentos` (inventário). */
export class EquipamentoRepository extends BaseRepository<Equipamento, NovoEquipamento> {
  protected readonly tabela = 'equipamentos';
  protected readonly campos: CamposGravaveis<NovoEquipamento> = {
    nome: true,
    descricao: true,
    modalidade: true,
    estadoConservacao: true,
    status: true,
    valorDiaria: true,
    precoVenda: true,
    dataAquisicao: true,
    categoriaId: true,
    fornecedorId: true
  };

  /** Filtros combináveis da tela de inventário. Os trechos de SQL são fixos; só os valores variam. */
  filtrar(filtro: FiltroEquipamentos = {}): Promise<Equipamento[]> {
    const condicoes: string[] = [];
    const params: (string | number)[] = [];
    if (filtro.status) {
      condicoes.push('status = ?');
      params.push(filtro.status);
    }
    if (filtro.modalidade) {
      condicoes.push('modalidade = ?');
      params.push(filtro.modalidade);
    }
    if (filtro.categoriaId !== undefined) {
      condicoes.push('categoria_id = ?');
      params.push(filtro.categoriaId);
    }
    if (filtro.nome?.trim()) {
      condicoes.push('nome LIKE ?');
      params.push(`%${escaparLike(filtro.nome.trim())}%`);
    }
    return this.selecionar(condicoes.join(' AND '), params, 'ORDER BY nome, id');
  }

  listarPorStatus(status: StatusEquipamento): Promise<Equipamento[]> {
    return this.filtrar({ status });
  }

  listarPorCategoria(categoriaId: number): Promise<Equipamento[]> {
    return this.filtrar({ categoriaId });
  }

  /** Busca vários de uma vez (ex.: os itens de uma reserva). Ids repetidos são ignorados. */
  async buscarPorIds(ids: number[]): Promise<Equipamento[]> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return [];
    const marcadores = unicos.map(() => '?').join(', ');
    return this.selecionar(`id IN (${marcadores})`, unicos);
  }

  async atualizarStatus(id: number, status: StatusEquipamento): Promise<boolean> {
    const { linhasAfetadas } = await this.db.executar(
      'UPDATE equipamentos SET status = ? WHERE id = ?',
      [status, id]
    );
    return linhasAfetadas > 0;
  }
}
