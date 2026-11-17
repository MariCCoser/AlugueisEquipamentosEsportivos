import type { TipoFornecedor } from '@shared/models/enums';
import type { Fornecedor, NovoFornecedor } from '@shared/models/entidades';
import type { ParametroSql } from '../database/Database';
import { BaseRepository, escaparLike, type CamposGravaveis } from './BaseRepository';

export interface FiltroFornecedor {
  tipo?: TipoFornecedor;
  /** Parte da razão social ou começo do CNPJ (só dígitos). */
  busca?: string;
}

/** Quantos registros de outras tabelas apontam para o fornecedor. */
export interface VinculosFornecedor {
  equipamentos: number;
  manutencoes: number;
}

/** Tabela `fornecedores` (de COMPRA de equipamentos ou de MANUTENCAO). */
export class FornecedorRepository extends BaseRepository<Fornecedor, NovoFornecedor> {
  protected readonly tabela = 'fornecedores';
  protected readonly campos: CamposGravaveis<NovoFornecedor> = {
    razaoSocial: true,
    cnpj: true,
    tipo: true,
    contato: true,
    telefone: true,
    email: true
  };

  buscarPorCnpj(cnpj: string): Promise<Fornecedor | null> {
    return this.buscarUm('cnpj = ?', [cnpj]);
  }

  listarPorTipo(tipo: TipoFornecedor): Promise<Fornecedor[]> {
    return this.selecionar('tipo = ?', [tipo], 'ORDER BY razao_social, id');
  }

  /** Lista com filtros opcionais, em ordem de razão social. */
  listarFiltrado(filtro: FiltroFornecedor = {}): Promise<Fornecedor[]> {
    const condicoes: string[] = [];
    const params: ParametroSql[] = [];

    if (filtro.tipo) {
      condicoes.push('tipo = ?');
      params.push(filtro.tipo);
    }

    const busca = filtro.busca?.trim();
    if (busca) {
      const digitos = busca.replace(/\D/g, '');
      if (digitos) {
        condicoes.push('(razao_social LIKE ? OR cnpj LIKE ?)');
        params.push(`%${escaparLike(busca)}%`, `${digitos}%`);
      } else {
        condicoes.push('razao_social LIKE ?');
        params.push(`%${escaparLike(busca)}%`);
      }
    }

    return this.selecionar(condicoes.join(' AND '), params, 'ORDER BY razao_social, id');
  }

  /** Equipamentos comprados dele e manutenções feitas por ele (uma consulta só). */
  async contarVinculos(fornecedorId: number): Promise<VinculosFornecedor> {
    const [linha] = await this.db.consultar<{
      equipamentos: number | string;
      manutencoes: number | string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM equipamentos WHERE fornecedor_id = ?) AS equipamentos,
         (SELECT COUNT(*) FROM manutencoes  WHERE fornecedor_id = ?) AS manutencoes`,
      [fornecedorId, fornecedorId]
    );
    return {
      equipamentos: Number(linha?.equipamentos ?? 0),
      manutencoes: Number(linha?.manutencoes ?? 0)
    };
  }
}
