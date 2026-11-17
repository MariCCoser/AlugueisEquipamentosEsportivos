import type { Categoria, NovaCategoria } from '@shared/models/entidades';
import { BaseRepository, type CamposGravaveis, type Linha } from './BaseRepository';

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

  /**
   * Todas as categorias, em ordem alfabética, já com quantos equipamentos usam cada uma.
   * Uma consulta só (LEFT JOIN + GROUP BY), em vez de um COUNT por categoria.
   */
  async listarComUso(): Promise<(Categoria & { qtdEquipamentos: number })[]> {
    const linhas = await this.db.consultar<Linha>(
      `SELECT c.*, COUNT(e.id) AS qtd_equipamentos
         FROM categorias c
         LEFT JOIN equipamentos e ON e.categoria_id = c.id
        GROUP BY c.id
        ORDER BY c.nome`
    );
    return linhas.map((linha) => {
      const { qtd_equipamentos: qtd, ...categoria } = linha;
      return { ...this.paraEntidade(categoria), qtdEquipamentos: Number(qtd ?? 0) };
    });
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
