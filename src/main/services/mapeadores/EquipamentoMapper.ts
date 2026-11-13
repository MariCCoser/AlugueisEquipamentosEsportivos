import type { CriarEquipamentoDTO, EquipamentoDTO } from '@shared/dto/equipamento.dto';
import type { Categoria, Equipamento, Fornecedor, NovoEquipamento } from '@shared/models/entidades';

/** Converte entre o registro do banco (`Equipamento`) e o que trafega no IPC (`EquipamentoDTO`). */
export class EquipamentoMapper {
  /**
   * @param categoria  categoria do item (dá o nome e o `sensivelClima` para a tela)
   * @param fornecedor fornecedor de compra, se houver
   */
  static paraDTO(
    equipamento: Equipamento,
    categoria: Pick<Categoria, 'nome' | 'sensivelClima'> | undefined,
    fornecedor?: Pick<Fornecedor, 'razaoSocial'>
  ): EquipamentoDTO {
    const dto: EquipamentoDTO = {
      id: equipamento.id,
      nome: equipamento.nome,
      modalidade: equipamento.modalidade,
      estadoConservacao: equipamento.estadoConservacao,
      status: equipamento.status,
      categoriaId: equipamento.categoriaId,
      categoriaNome: categoria?.nome ?? '',
      sensivelClima: categoria?.sensivelClima ?? false
    };
    if (equipamento.descricao) dto.descricao = equipamento.descricao;
    if (equipamento.valorDiaria != null) dto.valorDiaria = equipamento.valorDiaria;
    if (equipamento.precoVenda != null) dto.precoVenda = equipamento.precoVenda;
    if (equipamento.dataAquisicao) dto.dataAquisicao = equipamento.dataAquisicao;
    if (equipamento.fornecedorId != null) dto.fornecedorId = equipamento.fornecedorId;
    if (fornecedor) dto.fornecedorNome = fornecedor.razaoSocial;
    return dto;
  }

  /** Novo item sempre entra DISPONIVEL; o status só muda pelas regras (reserva, manutenção). */
  static paraNovo(dados: CriarEquipamentoDTO): NovoEquipamento {
    return {
      nome: dados.nome.trim(),
      descricao: dados.descricao?.trim() || null,
      modalidade: dados.modalidade,
      estadoConservacao: dados.estadoConservacao,
      status: 'DISPONIVEL',
      valorDiaria: dados.valorDiaria ?? null,
      precoVenda: dados.precoVenda ?? null,
      dataAquisicao: dados.dataAquisicao ?? null,
      categoriaId: dados.categoriaId,
      fornecedorId: dados.fornecedorId ?? null
    };
  }

  /**
   * Edição: copia campo a campo só o que veio. O `status` nunca entra aqui,
   * mesmo que a tela mande — ele muda só por `alterarStatus` e pelas regras.
   */
  static paraAtualizacao(dados: Partial<CriarEquipamentoDTO>): Partial<NovoEquipamento> {
    const alteracoes: Partial<NovoEquipamento> = {};
    if (dados.nome !== undefined) alteracoes.nome = dados.nome.trim();
    if (dados.descricao !== undefined) alteracoes.descricao = dados.descricao.trim() || null;
    if (dados.modalidade !== undefined) alteracoes.modalidade = dados.modalidade;
    if (dados.estadoConservacao !== undefined) {
      alteracoes.estadoConservacao = dados.estadoConservacao;
    }
    if (dados.valorDiaria !== undefined) alteracoes.valorDiaria = dados.valorDiaria;
    if (dados.precoVenda !== undefined) alteracoes.precoVenda = dados.precoVenda;
    if (dados.dataAquisicao !== undefined) alteracoes.dataAquisicao = dados.dataAquisicao;
    if (dados.categoriaId !== undefined) alteracoes.categoriaId = dados.categoriaId;
    if (dados.fornecedorId !== undefined) alteracoes.fornecedorId = dados.fornecedorId;
    return alteracoes;
  }
}
