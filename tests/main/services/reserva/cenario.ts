import { MultaPercentual } from '../../../../src/main/services/multa/MultaPercentual';
import { ReservaService } from '../../../../src/main/services/reserva/ReservaService';
import { BancoEmMemoria } from './BancoEmMemoria';

/**
 * Cenário comum aos testes da etapa 4: cliente, bike (R$ 45) e caiaque (R$ 90)
 * reservados de 20/11 a 22/11 (2 diárias, total R$ 270), caução de R$ 81.
 */
export async function cenarioReserva(opcoes: { ativa?: boolean } = { ativa: true }) {
  const banco = new BancoEmMemoria();
  const reservas = new ReservaService(banco, new MultaPercentual(), () => '2026-11-13');
  const cliente = banco.cliente();
  const bike = banco.equipamento({ nome: 'Bike', valorDiaria: 45 });
  const caiaque = banco.equipamento({ nome: 'Caiaque', valorDiaria: 90 });
  const reserva = await reservas.criar(
    {
      clienteId: cliente.id,
      dataRetirada: '2026-11-20',
      dataDevolucaoPrevista: '2026-11-22',
      itens: [{ equipamentoId: bike.id }, { equipamentoId: caiaque.id }],
      valorCaucao: 81
    },
    1
  );
  if (opcoes.ativa) await reservas.confirmarRetirada(reserva.id);
  const itens = banco.itensDa(reserva.id);
  return { banco, reservas, cliente, bike, caiaque, reservaId: reserva.id, itens };
}
