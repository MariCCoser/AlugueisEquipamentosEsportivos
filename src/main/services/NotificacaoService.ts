import type { DestinatarioDTO, NotificacaoDTO } from '@shared/dto/notificacao.dto';
import type { Cliente } from '@shared/models/entidades';
import { NaoEncontradoError, RegraNegocioError } from '../errors/ErroApp';
import type { NotificacaoClient } from '../integrations/NotificacaoClient';
import type { Repositorios } from '../repositories';

/** Só os repositórios que este service usa. */
export type RepositoriosNotificacao = Pick<
  Repositorios,
  'reservas' | 'clientes' | 'itensReserva' | 'equipamentos' | 'multas'
>;

/**
 * Junta os dados do banco e pede para a nossa API avisar o cliente.
 * O banco só é lido — nada é gravado aqui.
 */
export class NotificacaoService {
  constructor(
    private readonly repos: RepositoriosNotificacao,
    private readonly cliente: NotificacaoClient
  ) {}

  /** Lembra o cliente de devolver os equipamentos de uma reserva. */
  async enviarLembrete(reservaId: number): Promise<NotificacaoDTO> {
    const reserva = await this.repos.reservas.buscarPorId(reservaId);
    if (!reserva) throw new NaoEncontradoError('Reserva não encontrada.');
    if (reserva.status !== 'PENDENTE' && reserva.status !== 'ATIVA') {
      throw new RegraNegocioError(
        'Só dá para lembrar a devolução de reservas pendentes ou ativas.'
      );
    }

    const itens = await this.repos.itensReserva.listarPorReserva(reserva.id);
    const equipamentos = await this.repos.equipamentos.buscarPorIds(
      itens.map((item) => item.equipamentoId)
    );

    return this.cliente.enviarLembrete({
      cliente: await this.destinatario(reserva.clienteId),
      reservaId: reserva.id,
      dataDevolucaoPrevista: reserva.dataDevolucaoPrevista,
      equipamentos: equipamentos.map((equipamento) => equipamento.nome)
    });
  }

  /** Avisa o cliente sobre a multa de uma devolução atrasada. */
  async enviarAvisoMulta(multaId: number): Promise<NotificacaoDTO> {
    const multa = await this.repos.multas.buscarPorId(multaId);
    if (!multa) throw new NaoEncontradoError('Multa não encontrada.');
    if (multa.quitada) {
      throw new RegraNegocioError('Esta multa já foi paga; não é preciso avisar o cliente.');
    }

    const reserva = await this.repos.reservas.buscarPorId(multa.reservaId);
    if (!reserva) throw new NaoEncontradoError('Reserva da multa não encontrada.');

    return this.cliente.enviarAvisoMulta({
      cliente: await this.destinatario(reserva.clienteId),
      multaId: multa.id,
      reservaId: reserva.id,
      diasAtraso: multa.diasAtraso,
      valor: multa.valor
    });
  }

  /** Só o necessário para a mensagem chegar: nome, e-mail e telefone (nada de CPF ou endereço). */
  private async destinatario(clienteId: number): Promise<DestinatarioDTO> {
    const cliente: Cliente | null = await this.repos.clientes.buscarPorId(clienteId);
    if (!cliente) throw new NaoEncontradoError('Cliente da reserva não encontrado.');
    return {
      nome: cliente.nome,
      telefone: cliente.telefone,
      ...(cliente.email ? { email: cliente.email } : {})
    };
  }
}
