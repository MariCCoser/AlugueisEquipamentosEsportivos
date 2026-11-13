import type { TipoFornecedor } from '@shared/models/enums';
import type { Fornecedor, NovoFornecedor } from '@shared/models/entidades';
import { BaseRepository, type CamposGravaveis } from './BaseRepository';

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
}
