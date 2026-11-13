import type { Cliente, NovoCliente } from '@shared/models/entidades';
import { BaseRepository, escaparLike, type CamposGravaveis } from './BaseRepository';

/** Tabela `clientes`. CPF e CEP ficam só com dígitos no banco. */
export class ClienteRepository extends BaseRepository<Cliente, NovoCliente> {
  protected readonly tabela = 'clientes';
  protected readonly campos: CamposGravaveis<NovoCliente> = {
    nome: true,
    cpf: true,
    telefone: true,
    email: true,
    cep: true,
    rua: true,
    numero: true,
    complemento: true,
    bairro: true,
    cidade: true,
    uf: true
  };

  buscarPorCpf(cpf: string): Promise<Cliente | null> {
    return this.buscarUm('cpf = ?', [cpf]);
  }

  /** Busca por parte do nome ou pelo começo do CPF (campo de pesquisa da tela). */
  pesquisar(termo: string, limite = 50): Promise<Cliente[]> {
    const texto = escaparLike(termo.trim());
    return this.selecionar(
      'nome LIKE ? OR cpf LIKE ?',
      [`%${texto}%`, `${texto}%`],
      'ORDER BY nome, id LIMIT ?',
      [limite]
    );
  }
}
