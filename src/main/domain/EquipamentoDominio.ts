import type { Equipamento } from '@shared/models/entidades';
import type { EstadoConservacao, Modalidade, StatusEquipamento } from '@shared/models/enums';
import { ValidacaoError } from '../errors/ErroApp';
import { EquipamentoIndisponivelError, type MotivoIndisponivel } from '../errors/ReservaErrors';
import { Dinheiro } from './Dinheiro';

/** Campos do equipamento que as regras usam (o registro do repositório serve direto). */
export type DadosEquipamento = Pick<
  Equipamento,
  'id' | 'nome' | 'modalidade' | 'estadoConservacao' | 'status' | 'valorDiaria' | 'precoVenda'
>;

/**
 * Regras de um item do inventário que dependem só dele mesmo.
 *
 * `Equipamento` (em shared/models) é o formato dos DADOS da tabela; esta classe
 * envolve esses dados e aplica as REGRAS. Regras que dependem de outras tabelas
 * (reserva sobreposta, manutenção aberta) ficam no DisponibilidadeService.
 */
export class EquipamentoDominio {
  constructor(private readonly dados: DadosEquipamento) {
    EquipamentoDominio.validarPreco(dados.modalidade, dados.valorDiaria, dados.precoVenda);
  }

  get id(): number {
    return this.dados.id;
  }

  get nome(): string {
    return this.dados.nome;
  }

  get status(): StatusEquipamento {
    return this.dados.status;
  }

  get estadoConservacao(): EstadoConservacao {
    return this.dados.estadoConservacao;
  }

  /** Mesma regra do CHECK ck_equipamentos_preco, para dar mensagem amigável antes do banco. */
  static validarPreco(
    modalidade: Modalidade,
    valorDiaria: number | null | undefined,
    precoVenda: number | null | undefined
  ): void {
    if (modalidade === 'LOCACAO' && !(valorDiaria != null && valorDiaria > 0)) {
      throw new ValidacaoError('Equipamento para locação precisa de valor da diária.', {
        valorDiaria: 'Informe um valor maior que zero.'
      });
    }
    if (modalidade === 'VENDA' && !(precoVenda != null && precoVenda > 0)) {
      throw new ValidacaoError('Equipamento para venda precisa de preço de venda.', {
        precoVenda: 'Informe um valor maior que zero.'
      });
    }
  }

  /** Valor da diária que será "congelado" no item da reserva. */
  diaria(): Dinheiro {
    if (this.dados.modalidade !== 'LOCACAO' || this.dados.valorDiaria == null) {
      throw new EquipamentoIndisponivelError(this.nome, 'SOMENTE_VENDA');
    }
    return Dinheiro.deReais(this.dados.valorDiaria);
  }

  /**
   * Motivo pelo qual o item não pode ser reservado, olhando só o cadastro dele,
   * ou null se não há impedimento. RESERVADO não impede: o item pode estar
   * alugado agora e livre no período pedido — quem decide é o DisponibilidadeService.
   */
  impedimentoParaReserva(): MotivoIndisponivel | null {
    if (this.dados.modalidade !== 'LOCACAO') return 'SOMENTE_VENDA';
    if (this.dados.status === 'INDISPONIVEL') return 'INDISPONIVEL';
    if (this.dados.status === 'EM_MANUTENCAO') return 'EM_MANUTENCAO';
    return null;
  }

  garantirReservavel(): void {
    const motivo = this.impedimentoParaReserva();
    if (motivo) throw new EquipamentoIndisponivelError(this.nome, motivo);
  }
}
