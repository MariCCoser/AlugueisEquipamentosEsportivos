import type { Categoria, NovaCategoria } from '@shared/models/entidades';
import { BaseRepository, type CamposGravaveis } from './BaseRepository';

/** Tabela `categorias`. `sensivelClima` liga o alerta de previsão do tempo na reserva. */
export class CategoriaRepository extends BaseRepository<Categoria, NovaCategoria> {
  protected readonly tabela = 'categorias';
  protected readonly campos: CamposGravaveis<NovaCategoria> = {
    nome: true,
    descricao: true,
    sensivelClima: true
  };
  protected override readonly camposBooleanos = ['sensivelClima'] as const;

  buscarPorNome(nome: string): Promise<Categoria | null> {
    return this.buscarUm('nome = ?', [nome.trim()]);
  }

  /** Quantos equipamentos usam a categoria (a FK impede excluir se for > 0). */
  async contarEquipamentos(categoriaId: number): Promise<number> {
    const [linha] = await this.db.consultar<{ total: number | string }>(
      'SELECT COUNT(*) AS total FROM equipamentos WHERE categoria_id = ?',
      [categoriaId]
    );
    return Number(linha?.total ?? 0);
  }
}
