import type { DataISO } from '@shared/dto/resposta';
import type { CaucaoStatus, StatusReserva } from '@shared/models/enums';
import { RegraNegocioError, ValidacaoError } from '../errors/ErroApp';
import { CalendarioISO } from './CalendarioISO';
import { CicloReserva } from './CicloReserva';
import { Dinheiro } from './Dinheiro';
import type { Periodo } from './Periodo';

export interface ItemDaReserva {
  equipamentoId: number;
  /** Diária copiada do equipamento no momento da reserva (não muda se o preço mudar depois). */
  diaria: Dinheiro;
}

export interface DadosReserva {
  status: StatusReserva;
  periodo: Periodo;
  itens: ItemDaReserva[];
  valorCaucao: Dinheiro;
  caucaoStatus: CaucaoStatus;
  dataDevolucaoReal?: DataISO;
}

/**
 * Regras do contrato de locação (os DADOS da tabela são o tipo `Reserva` de
 * shared/models; esta classe aplica as REGRAS). Calcula valores e controla as mudanças de status
 * (sempre passando pelo CicloReserva). Não acessa banco: o ReservaService
 * carrega/salva os dados e usa esta classe para aplicar as regras.
 */
export class ReservaDominio {
  /** Caução sugerida pelo grupo: 30% do valor total. */
  static readonly PERCENTUAL_CAUCAO_SUGERIDA = 30;

  private constructor(private dados: DadosReserva) {}

  /** Nova reserva (status PENDENTE). */
  static nova(periodo: Periodo, itens: ItemDaReserva[], valorCaucao: Dinheiro): ReservaDominio {
    if (itens.length === 0) {
      throw new ValidacaoError('A reserva precisa de pelo menos um equipamento.');
    }
    const ids = new Set(itens.map((item) => item.equipamentoId));
    if (ids.size !== itens.length) {
      throw new ValidacaoError('O mesmo equipamento foi incluído mais de uma vez.');
    }
    if (valorCaucao.ehNegativo()) {
      throw new ValidacaoError('A caução não pode ser negativa.');
    }
    return new ReservaDominio({
      status: 'PENDENTE',
      periodo,
      itens: [...itens],
      valorCaucao,
      caucaoStatus: valorCaucao.ehZero() ? 'NAO_APLICAVEL' : 'RETIDA'
    });
  }

  /** Reconstrói uma reserva já gravada (dados vindos do banco). */
  static restaurar(dados: DadosReserva): ReservaDominio {
    return new ReservaDominio({ ...dados, itens: [...dados.itens] });
  }

  static caucaoSugerida(valorTotal: Dinheiro): Dinheiro {
    return valorTotal.porcentagem(ReservaDominio.PERCENTUAL_CAUCAO_SUGERIDA);
  }

  get status(): StatusReserva {
    return this.dados.status;
  }

  get periodo(): Periodo {
    return this.dados.periodo;
  }

  get itens(): readonly ItemDaReserva[] {
    return this.dados.itens;
  }

  get valorCaucao(): Dinheiro {
    return this.dados.valorCaucao;
  }

  get caucaoStatus(): CaucaoStatus {
    return this.dados.caucaoStatus;
  }

  get dataDevolucaoReal(): DataISO | undefined {
    return this.dados.dataDevolucaoReal;
  }

  /** Valor de um dia de aluguel de todos os itens juntos. */
  somaDiarias(): Dinheiro {
    return Dinheiro.somarTodos(this.dados.itens.map((item) => item.diaria));
  }

  /** Soma das diárias × quantidade de diárias do período. */
  valorTotal(): Dinheiro {
    return this.somaDiarias().multiplicar(this.dados.periodo.diarias());
  }

  /** Itens e datas só podem mudar enquanto a reserva não começou. */
  podeSerEditada(): boolean {
    return this.dados.status === 'PENDENTE';
  }

  confirmarRetirada(): void {
    this.mudarStatus('ATIVA');
  }

  cancelar(): void {
    this.mudarStatus('CANCELADA');
  }

  /**
   * Finaliza a locação e devolve os dias de atraso (0 se no prazo).
   * Quem gera a multa com esse número é o DevolucaoService, usando a EstrategiaMulta.
   */
  registrarDevolucao(dataReal: DataISO): number {
    if (CalendarioISO.diasEntre(this.dados.periodo.retirada, dataReal) < 0) {
      throw new RegraNegocioError('A devolução não pode ser anterior à data de retirada.');
    }
    this.mudarStatus('DEVOLVIDA');
    this.dados = { ...this.dados, dataDevolucaoReal: dataReal };
    return this.dados.periodo.diasAtraso(dataReal);
  }

  /** Reserva ATIVA com prazo vencido em relação a `hoje`. */
  estaAtrasada(hoje: DataISO): boolean {
    return this.dados.status === 'ATIVA' && this.dados.periodo.diasAtraso(hoje) > 0;
  }

  private mudarStatus(novo: StatusReserva): void {
    CicloReserva.validar(this.dados.status, novo);
    this.dados = { ...this.dados, status: novo };
  }
}
