import { describe, expect, it, vi } from 'vitest';
import type { NotificacaoDTO } from '../../../src/shared/dto/notificacao.dto';
import type { NotificacaoClient } from '../../../src/main/integrations/NotificacaoClient';
import { criarRepositorios } from '../../../src/main/repositories';
import { NotificacaoService } from '../../../src/main/services/NotificacaoService';
import { ExecutorFalso } from '../repositories/ExecutorFalso';

/** Linhas "do banco" usadas nos testes (iguais às do seed). */
const reservaAtiva = {
  id: 3,
  cliente_id: 3,
  status: 'ATIVA',
  data_devolucao_prevista: '2026-11-16'
};
const carla = {
  id: 3,
  nome: 'Carla Mendes',
  telefone: '41991234567',
  email: null,
  cpf: '98765432100'
};

function montar() {
  const db = new ExecutorFalso();
  const notificacao = { id: 'n1' } as NotificacaoDTO;
  const cliente = {
    enviarLembrete: vi.fn(async () => notificacao),
    enviarAvisoMulta: vi.fn(async () => notificacao)
  };
  const servico = new NotificacaoService(
    criarRepositorios(db),
    cliente as unknown as NotificacaoClient
  );
  return { db, cliente, servico };
}

describe('NotificacaoService.enviarLembrete', () => {
  it('junta reserva, cliente e equipamentos e manda para a API', async () => {
    const { db, cliente, servico } = montar();
    db.responderConsulta(reservaAtiva) // reservas.buscarPorId
      .responderConsulta({ id: 4, reserva_id: 3, equipamento_id: 1 }) // itensReserva.listarPorReserva
      .responderConsulta({ id: 1, nome: 'Mountain Bike Aro 29' }) // equipamentos.buscarPorIds
      .responderConsulta(carla); // clientes.buscarPorId

    expect(await servico.enviarLembrete(3)).toEqual({ id: 'n1' });

    expect(cliente.enviarLembrete).toHaveBeenCalledWith({
      // sem e-mail -> não manda o campo; e nada de CPF ou endereço
      cliente: { nome: 'Carla Mendes', telefone: '41991234567' },
      reservaId: 3,
      dataDevolucaoPrevista: '2026-11-16',
      equipamentos: ['Mountain Bike Aro 29']
    });
  });

  it('reserva inexistente -> NAO_ENCONTRADO, sem chamar a API', async () => {
    const { cliente, servico } = montar();
    await expect(servico.enviarLembrete(99)).rejects.toMatchObject({ codigo: 'NAO_ENCONTRADO' });
    expect(cliente.enviarLembrete).not.toHaveBeenCalled();
  });

  it('reserva já devolvida -> REGRA_NEGOCIO', async () => {
    const { db, servico } = montar();
    db.responderConsulta({ ...reservaAtiva, status: 'DEVOLVIDA' });
    await expect(servico.enviarLembrete(3)).rejects.toMatchObject({ codigo: 'REGRA_NEGOCIO' });
  });
});

describe('NotificacaoService.enviarAvisoMulta', () => {
  it('manda valor e dias de atraso da multa', async () => {
    const { db, cliente, servico } = montar();
    db.responderConsulta({ id: 7, reserva_id: 3, dias_atraso: 2, valor: 32, quitada: 0 })
      .responderConsulta(reservaAtiva)
      .responderConsulta({ ...carla, email: 'carla@email.com' });

    await servico.enviarAvisoMulta(7);

    expect(cliente.enviarAvisoMulta).toHaveBeenCalledWith({
      cliente: { nome: 'Carla Mendes', telefone: '41991234567', email: 'carla@email.com' },
      multaId: 7,
      reservaId: 3,
      diasAtraso: 2,
      valor: 32
    });
  });

  it('multa já paga -> REGRA_NEGOCIO', async () => {
    const { db, cliente, servico } = montar();
    db.responderConsulta({ id: 7, reserva_id: 3, quitada: 1 });
    await expect(servico.enviarAvisoMulta(7)).rejects.toMatchObject({ codigo: 'REGRA_NEGOCIO' });
    expect(cliente.enviarAvisoMulta).not.toHaveBeenCalled();
  });
});
