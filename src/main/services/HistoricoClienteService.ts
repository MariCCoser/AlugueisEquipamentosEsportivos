import type { HistoricoClienteDTO } from '@shared/dto/cliente.dto';
import type { MultaDTO } from '@shared/dto/multa.dto';
import type { PagamentoDTO } from '@shared/dto/pagamento.dto';
import { CicloReserva } from '../domain/CicloReserva';
import { Dinheiro } from '../domain/Dinheiro';
import { NaoEncontradoError } from '../errors/ErroApp';
import { ClienteMapper } from './mapeadores/ClienteMapper';
import { PagamentoMapper } from './mapeadores/PagamentoMapper';
import { ReservaMontador } from './mapeadores/ReservaMontador';
import type { AcessoDados } from './UnidadeDeTrabalho';

/**
 * Tela de detalhes do cliente: reservas em andamento, reservas anteriores,
 * pagamentos feitos e multas ainda não pagas (com o total pendente).
 */
export class HistoricoClienteService {
  constructor(private readonly dados: AcessoDados) {}

  async historico(clienteId: number): Promise<HistoricoClienteDTO> {
    const { repos } = this.dados;
    const cliente = await repos.clientes.buscarPorId(clienteId);
    if (!cliente) throw new NaoEncontradoError('Cliente', clienteId);

    const montador = new ReservaMontador(repos);
    const reservas = await repos.reservas.listarPorCliente(clienteId);
    const resumos = await montador.resumos(reservas);

    const pagamentos: PagamentoDTO[] = [];
    const multasEmAberto: MultaDTO[] = [];
    let totalPendente = Dinheiro.ZERO;
    for (const reserva of reservas) {
      const doReserva = await repos.pagamentos.listarPorReserva(reserva.id);
      pagamentos.push(...doReserva.map((p) => PagamentoMapper.paraDTO(p)));

      const multa = await repos.multas.buscarPorReserva(reserva.id);
      if (multa && !multa.quitada) {
        const dto = await montador.multa(multa, cliente.nome);
        multasEmAberto.push(dto);
        totalPendente = totalPendente.somar(
          Dinheiro.deReais(dto.valor).subtrair(Dinheiro.deReais(dto.valorPago))
        );
      }
    }

    return {
      cliente: ClienteMapper.paraDTO(cliente),
      reservasAtivas: resumos.filter((r) => CicloReserva.ocupaEquipamentos(r.status)),
      reservasAnteriores: resumos.filter((r) => !CicloReserva.ocupaEquipamentos(r.status)),
      pagamentos: pagamentos.sort((a, b) => b.data.localeCompare(a.data)),
      multasEmAberto,
      totalPendente: totalPendente.emReais()
    };
  }
}
