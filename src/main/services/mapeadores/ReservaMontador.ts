import type { MultaDTO } from '@shared/dto/multa.dto';
import type { ItemReservaDTO, ReservaDTO, ReservaResumoDTO } from '@shared/dto/reserva.dto';
import type { Equipamento, ItemReserva, Multa, Reserva } from '@shared/models/entidades';
import type { Repositorios } from '../../repositories';

type ReposMontador = Pick<
  Repositorios,
  'clientes' | 'equipamentos' | 'itensReserva' | 'pagamentos' | 'multas'
>;

/**
 * Monta os DTOs de reserva que a tela recebe. Diferente dos outros mapeadores,
 * precisa consultar o banco: nome do cliente, nomes dos equipamentos, total pago e multa.
 */
export class ReservaMontador {
  constructor(private readonly repos: ReposMontador) {}

  async completa(reserva: Reserva): Promise<ReservaDTO> {
    const itensGravados = await this.repos.itensReserva.listarPorReserva(reserva.id);
    const [base, itens, multa] = await Promise.all([
      this.base(reserva),
      this.itens(itensGravados),
      this.repos.multas.buscarPorReserva(reserva.id)
    ]);
    const dto: ReservaDTO = { ...base, itens };
    if (multa) dto.multa = await this.multa(multa, base.clienteNome);
    return dto;
  }

  async resumos(reservas: Reserva[]): Promise<ReservaResumoDTO[]> {
    const nomes = new Map<number, string>();
    const resultado: ReservaResumoDTO[] = [];
    for (const reserva of reservas) resultado.push(await this.resumo(reserva, nomes));
    return resultado;
  }

  /** Itens com o nome de cada equipamento (uma consulta só para todos). */
  async itens(itens: ItemReserva[]): Promise<ItemReservaDTO[]> {
    const equipamentos = await this.repos.equipamentos.buscarPorIds(
      itens.map((item) => item.equipamentoId)
    );
    const nomes = new Map<number, string>(equipamentos.map((e: Equipamento) => [e.id, e.nome]));
    return itens.map((item) => ReservaMontador.item(item, nomes.get(item.equipamentoId) ?? ''));
  }

  static item(item: ItemReserva, equipamentoNome: string): ItemReservaDTO {
    const dto: ItemReservaDTO = {
      id: item.id,
      reservaId: item.reservaId,
      equipamentoId: item.equipamentoId,
      equipamentoNome,
      valorDiaria: item.valorDiaria,
      estadoRetirada: item.estadoRetirada
    };
    if (item.estadoDevolucao) dto.estadoDevolucao = item.estadoDevolucao;
    return dto;
  }

  async multa(multa: Multa, clienteNome: string): Promise<MultaDTO> {
    const dto: MultaDTO = {
      id: multa.id,
      reservaId: multa.reservaId,
      clienteNome,
      diasAtraso: multa.diasAtraso,
      valor: multa.valor,
      quitada: multa.quitada,
      valorPago: await this.repos.pagamentos.somarPorMulta(multa.id)
    };
    if (multa.dataQuitacao) dto.dataQuitacao = multa.dataQuitacao;
    return dto;
  }

  private async resumo(
    reserva: Reserva,
    cacheNomes: Map<number, string>
  ): Promise<ReservaResumoDTO> {
    const [base, itens] = await Promise.all([
      this.base(reserva, cacheNomes),
      this.repos.itensReserva.listarPorReserva(reserva.id)
    ]);
    return { ...base, qtdItens: itens.length };
  }

  /**
   * Campos comuns à reserva completa e ao resumo.
   * @param cacheNomes evita buscar o mesmo cliente várias vezes numa lista
   */
  private async base(
    reserva: Reserva,
    cacheNomes = new Map<number, string>()
  ): Promise<Omit<ReservaDTO, 'itens' | 'multa'>> {
    const [clienteNome, totalPago] = await Promise.all([
      this.nomeCliente(reserva.clienteId, cacheNomes),
      this.repos.pagamentos.somarPorReserva(reserva.id)
    ]);
    const dto: Omit<ReservaDTO, 'itens' | 'multa'> = {
      id: reserva.id,
      clienteId: reserva.clienteId,
      clienteNome,
      usuarioId: reserva.usuarioId,
      dataRetirada: reserva.dataRetirada,
      dataDevolucaoPrevista: reserva.dataDevolucaoPrevista,
      status: reserva.status,
      valorTotal: reserva.valorTotal,
      valorCaucao: reserva.valorCaucao,
      caucaoStatus: reserva.caucaoStatus,
      totalPago
    };
    if (reserva.dataDevolucaoReal) dto.dataDevolucaoReal = reserva.dataDevolucaoReal;
    if (reserva.observacoes) dto.observacoes = reserva.observacoes;
    return dto;
  }

  private async nomeCliente(id: number, cache: Map<number, string>): Promise<string> {
    const salvo = cache.get(id);
    if (salvo !== undefined) return salvo;
    const nome = (await this.repos.clientes.buscarPorId(id))?.nome ?? '';
    cache.set(id, nome);
    return nome;
  }
}
