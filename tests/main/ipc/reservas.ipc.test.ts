import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import type { UsuarioSessaoDTO } from '../../../src/shared/dto/auth.dto';
import type { ItemReservaService } from '../../../src/main/services/reserva/ItemReservaService';
import type { ReservaService } from '../../../src/main/services/reserva/ReservaService';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));

const { RegistroIpc } = await import('../../../src/main/ipc/registrarHandlers');
const { registrarReservasIpc } = await import('../../../src/main/ipc/reservas.ipc');

const evento = { senderFrame: { url: 'app://tela' } } as unknown as IpcMainInvokeEvent;
const funcionaria: UsuarioSessaoDTO = {
  id: 2,
  nome: 'Funcionária',
  email: 'f@aluguel.local',
  perfil: 'FUNCIONARIO'
};

function montar(usuario: UsuarioSessaoDTO | null = funcionaria) {
  const registro = new RegistroIpc({
    origemConfiavel: (url) => url === 'app://tela',
    perfilAtual: () => usuario?.perfil ?? null
  });
  const reservas = {
    criar: vi.fn(async (dados, usuarioId: number) => ({ id: 1, ...dados, usuarioId })),
    listarAtivas: vi.fn(async () => []),
    cancelar: vi.fn(async (dados) => dados)
  };
  const itens = { listarPorReserva: vi.fn(async () => []) };
  registrarReservasIpc(
    registro,
    reservas as unknown as ReservaService,
    itens as unknown as ItemReservaService,
    { usuarioAtual: () => usuario }
  );
  return { registro, reservas, itens };
}

const pedido = {
  clienteId: 1,
  dataRetirada: '2026-11-20',
  dataDevolucaoPrevista: '2026-11-22',
  itens: [{ equipamentoId: 3 }],
  valorCaucao: 0
};

describe('canais de reservas', () => {
  it('registram tudo, menos a devolução (etapa 4)', () => {
    const pendentes = montar().registro.canaisPendentes();
    expect(pendentes.filter((c) => c.startsWith('reservas:'))).toEqual([
      'reservas:registrarDevolucao'
    ]);
    expect(pendentes.filter((c) => c.startsWith('itensReserva:'))).toEqual([]);
  });

  it('usuarioId vem da sessão; preço e usuário mandados pela tela são ignorados', async () => {
    const m = montar();
    const resposta = await m.registro.atender('reservas:criar', evento, {
      ...pedido,
      usuarioId: 1, // tentando se passar pelo admin
      valorTotal: 1,
      itens: [{ equipamentoId: 3, valorDiaria: 0.01 }]
    });
    expect(resposta.ok).toBe(true);
    const [dados, usuarioId] = m.reservas.criar.mock.calls[0]!;
    expect(usuarioId).toBe(2);
    expect(dados).not.toHaveProperty('usuarioId');
    expect(dados).not.toHaveProperty('valorTotal');
    expect(dados.itens).toEqual([{ equipamentoId: 3 }]);
  });

  it('reserva sem itens volta como VALIDACAO', async () => {
    const resposta = await montar().registro.atender('reservas:criar', evento, {
      ...pedido,
      itens: []
    });
    expect(resposta).toMatchObject({
      ok: false,
      erro: { codigo: 'VALIDACAO', campos: { itens: 'Escolha pelo menos um equipamento.' } }
    });
  });

  it('sem login nada passa', async () => {
    const m = montar(null);
    const resposta = await m.registro.atender('reservas:criar', evento, pedido);
    expect(resposta).toMatchObject({ ok: false, erro: { codigo: 'NAO_AUTORIZADO' } });
    expect(m.reservas.criar).not.toHaveBeenCalled();
  });

  it('cancelar aceita motivo opcional; listarAtivas não precisa de entrada', async () => {
    const m = montar();
    await m.registro.atender('reservas:cancelar', evento, { id: 4, motivo: '  Chuva ' });
    expect(m.reservas.cancelar).toHaveBeenCalledWith({ id: 4, motivo: 'Chuva' });
    expect(await m.registro.atender('reservas:listarAtivas', evento, undefined)).toEqual({
      ok: true,
      dados: []
    });
  });

  it('itensReserva:listarPorReserva valida o reservaId', async () => {
    const resposta = await montar().registro.atender('itensReserva:listarPorReserva', evento, {
      reservaId: 'abc'
    });
    expect(resposta).toMatchObject({ ok: false, erro: { codigo: 'VALIDACAO' } });
  });
});
