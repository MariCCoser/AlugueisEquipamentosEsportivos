import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import type { Perfil } from '../../../src/shared/models/enums';
import { RegraNegocioError } from '../../../src/main/errors/ErroApp';
import type { ClienteService } from '../../../src/main/services/ClienteService';
import type { DisponibilidadeService } from '../../../src/main/services/DisponibilidadeService';
import type { EquipamentoService } from '../../../src/main/services/EquipamentoService';

// O Electron não roda dentro do Vitest; trocamos o ipcMain por uma versão de mentira.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));

const { RegistroIpc } = await import('../../../src/main/ipc/registrarHandlers');
const { registrarClientesIpc } = await import('../../../src/main/ipc/clientes.ipc');
const { registrarEquipamentosIpc } = await import('../../../src/main/ipc/equipamentos.ipc');

const URL_DA_TELA = 'app://tela';
const evento = { senderFrame: { url: URL_DA_TELA } } as unknown as IpcMainInvokeEvent;

const clienteValido = {
  nome: 'Ana Souza',
  cpf: '52998224725',
  telefone: '11987654321',
  cep: '01310100',
  rua: 'Avenida Paulista',
  numero: '1000',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  uf: 'SP'
};

function montar(perfil: Perfil | null = 'FUNCIONARIO') {
  const registro = new RegistroIpc({
    origemConfiavel: (url) => url === URL_DA_TELA,
    perfilAtual: () => perfil
  });
  const clientes = {
    criar: vi.fn(async (dados) => ({ id: 1, ...dados })),
    listar: vi.fn(async () => ({ itens: [], total: 0, pagina: 1, porPagina: 20 })),
    buscarPorId: vi.fn(async (id: number) => ({ id })),
    atualizar: vi.fn(async (dados) => dados),
    excluir: vi.fn(async () => undefined)
  };
  const equipamentos = {
    criar: vi.fn(),
    listar: vi.fn(),
    buscarPorId: vi.fn(),
    atualizar: vi.fn(),
    excluir: vi.fn(),
    alterarStatus: vi.fn(),
    listarDisponiveis: vi.fn(async () => [])
  };
  const disponibilidade = { verificar: vi.fn(async () => ({ disponivel: true })) };
  registrarClientesIpc(registro, clientes as unknown as ClienteService);
  registrarEquipamentosIpc(
    registro,
    equipamentos as unknown as EquipamentoService,
    disponibilidade as unknown as DisponibilidadeService
  );
  return { registro, clientes, equipamentos, disponibilidade };
}

describe('canais de clientes e equipamentos', () => {
  it('registram todos os canais da etapa 2 (histórico fica para depois)', () => {
    const pendentes = montar().registro.canaisPendentes();
    expect(pendentes.filter((c) => c.startsWith('clientes:'))).toEqual(['clientes:historico']);
    expect(pendentes.filter((c) => c.startsWith('equipamentos:'))).toEqual([]);
  });

  it('entrada válida chega ao service já validada', async () => {
    const m = montar();
    const resposta = await m.registro.atender('clientes:criar', evento, {
      ...clienteValido,
      cpf: '529.982.247-25',
      hacker: true
    });
    expect(resposta.ok).toBe(true);
    expect(m.clientes.criar).toHaveBeenCalledWith(expect.not.objectContaining({ hacker: true }));
    expect(m.clientes.criar.mock.calls[0]?.[0]).toMatchObject({ cpf: '52998224725' });
  });

  it('entrada inválida volta como VALIDACAO com os campos, sem chamar o service', async () => {
    const m = montar();
    const resposta = await m.registro.atender('clientes:criar', evento, {
      ...clienteValido,
      cpf: '1'
    });
    expect(resposta).toEqual({
      ok: false,
      erro: {
        codigo: 'VALIDACAO',
        mensagem: 'Dados inválidos. Confira os campos destacados.',
        campos: { cpf: 'CPF deve ter 11 dígitos.' }
      }
    });
    expect(m.clientes.criar).not.toHaveBeenCalled();
  });

  it('erro de regra do service chega à tela com a mensagem dele', async () => {
    const m = montar('ADMIN');
    m.clientes.excluir.mockRejectedValueOnce(new RegraNegocioError('Cliente tem reservas.'));
    expect(await m.registro.atender('clientes:excluir', evento, { id: 1 })).toEqual({
      ok: false,
      erro: { codigo: 'REGRA_NEGOCIO', mensagem: 'Cliente tem reservas.' }
    });
  });

  it('erro inesperado continua genérico (sem vazar detalhes)', async () => {
    const m = montar();
    const silenciar = vi.spyOn(console, 'error').mockImplementation(() => {});
    m.clientes.listar.mockRejectedValueOnce(new Error('ECONNREFUSED 127.0.0.1:3306'));
    expect(await m.registro.atender('clientes:listar', evento, undefined)).toEqual({
      ok: false,
      erro: { codigo: 'INTERNO', mensagem: 'Erro inesperado. Tente novamente.' }
    });
    silenciar.mockRestore();
  });

  it('permissões continuam valendo: FUNCIONARIO não exclui cliente', async () => {
    const m = montar('FUNCIONARIO');
    const resposta = await m.registro.atender('clientes:excluir', evento, { id: 1 });
    expect(resposta).toMatchObject({ ok: false, erro: { codigo: 'NAO_AUTORIZADO' } });
    expect(m.clientes.excluir).not.toHaveBeenCalled();
  });

  it('verificarDisponibilidade valida o período antes de consultar', async () => {
    const m = montar();
    const resposta = await m.registro.atender('equipamentos:verificarDisponibilidade', evento, {
      equipamentoId: 1,
      dataRetirada: '2026-11-20',
      dataDevolucaoPrevista: '2026-11-22'
    });
    expect(resposta).toEqual({ ok: true, dados: { disponivel: true } });
  });
});
