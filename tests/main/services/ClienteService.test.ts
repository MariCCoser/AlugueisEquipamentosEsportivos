import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CriarClienteDTO } from '@shared/dto/cliente.dto';
import type { Cliente, Reserva } from '@shared/models/entidades';
import { NaoEncontradoError, RegraNegocioError } from '../../../src/main/errors/ErroApp';
import {
  ClienteService,
  type RepoClientes,
  type RepoReservasDoCliente
} from '../../../src/main/services/ClienteService';
import { erroMysql, umCliente } from './dadosTeste';

const entrada: CriarClienteDTO = {
  nome: '  Ana Souza ',
  cpf: '529.982.247-25',
  telefone: '(11) 98765-4321',
  email: '',
  cep: '01310-100',
  rua: 'Avenida Paulista',
  numero: '1000',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  uf: 'sp'
};

function criarRepos() {
  const clientes = {
    criar: vi.fn(async (novo) => umCliente({ ...novo, id: 7 }) as Cliente),
    buscarPorId: vi.fn(async (id: number) => (id === 1 ? umCliente() : null)),
    buscarPorCpf: vi.fn(async () => null as Cliente | null),
    pesquisar: vi.fn(async () => [umCliente(), umCliente({ id: 2, nome: 'Ana Lima' })]),
    listarPaginado: vi.fn(async () => ({
      itens: [umCliente()],
      total: 1,
      pagina: 1,
      porPagina: 20
    })),
    atualizar: vi.fn(async (id: number, dados) => umCliente({ id, ...dados }) as Cliente),
    excluir: vi.fn(async () => true)
  } satisfies RepoClientes;
  const reservas = {
    listarPorCliente: vi.fn(async () => [] as Reserva[])
  } satisfies RepoReservasDoCliente;
  return { clientes, reservas, service: new ClienteService(clientes, reservas) };
}

describe('ClienteService', () => {
  let r: ReturnType<typeof criarRepos>;
  beforeEach(() => {
    r = criarRepos();
  });

  describe('criar', () => {
    it('padroniza os dados antes de gravar', async () => {
      await r.service.criar(entrada);
      expect(r.clientes.criar).toHaveBeenCalledWith(
        expect.objectContaining({
          nome: 'Ana Souza',
          cpf: '52998224725',
          telefone: '11987654321',
          email: null,
          cep: '01310100',
          uf: 'SP'
        })
      );
    });

    it('devolve o DTO com CPF mascarado', async () => {
      const dto = await r.service.criar(entrada);
      expect(dto.id).toBe(7);
      expect(dto.cpfMascarado).toBe('***.982.247-**');
    });

    it('recusa CPF já cadastrado', async () => {
      r.clientes.buscarPorCpf.mockResolvedValueOnce(umCliente({ id: 3 }));
      await expect(r.service.criar(entrada)).rejects.toThrow(RegraNegocioError);
      expect(r.clientes.criar).not.toHaveBeenCalled();
    });

    it('traduz o UNIQUE do banco (dois cadastros ao mesmo tempo)', async () => {
      r.clientes.criar.mockRejectedValueOnce(erroMysql('ER_DUP_ENTRY'));
      await expect(r.service.criar(entrada)).rejects.toThrow(
        'Já existe um cliente cadastrado com este CPF.'
      );
    });
  });

  describe('listar', () => {
    it('sem busca usa a paginação do banco, ordenada por nome', async () => {
      const pagina = await r.service.listar({ pagina: 2 });
      expect(r.clientes.listarPaginado).toHaveBeenCalledWith({
        pagina: 2,
        porPagina: undefined,
        ordenarPor: 'nome'
      });
      expect(pagina.itens[0]?.cpfMascarado).toBe('***.982.247-**');
    });

    it('com busca pesquisa e pagina o resultado', async () => {
      const pagina = await r.service.listar({ busca: 'Ana', porPagina: 1 });
      expect(r.clientes.pesquisar).toHaveBeenCalledWith('Ana', ClienteService.LIMITE_BUSCA);
      expect(pagina.total).toBe(2);
      expect(pagina.itens).toHaveLength(1);
    });

    it('busca por CPF com pontuação procura só os dígitos', async () => {
      await r.service.listar({ busca: '529.982' });
      expect(r.clientes.pesquisar).toHaveBeenCalledWith('529982', ClienteService.LIMITE_BUSCA);
    });
  });

  it('buscarPorId inexistente lança NaoEncontrado', async () => {
    await expect(r.service.buscarPorId(99)).rejects.toThrow(NaoEncontradoError);
  });

  describe('atualizar', () => {
    it('grava só os campos enviados', async () => {
      await r.service.atualizar({ id: 1, telefone: '(11) 91111-2222' });
      expect(r.clientes.atualizar).toHaveBeenCalledWith(1, { telefone: '11911112222' });
    });

    it('permite manter o próprio CPF', async () => {
      r.clientes.buscarPorCpf.mockResolvedValueOnce(umCliente({ id: 1 }));
      await expect(r.service.atualizar({ id: 1, cpf: '52998224725' })).resolves.toBeDefined();
    });

    it('recusa CPF de outro cliente', async () => {
      r.clientes.buscarPorCpf.mockResolvedValueOnce(umCliente({ id: 2 }));
      await expect(r.service.atualizar({ id: 1, cpf: '52998224725' })).rejects.toThrow(
        RegraNegocioError
      );
    });
  });

  describe('excluir', () => {
    it('apaga cliente sem reservas', async () => {
      await r.service.excluir(1);
      expect(r.clientes.excluir).toHaveBeenCalledWith(1);
    });

    it('bloqueia cliente com reservas', async () => {
      r.reservas.listarPorCliente.mockResolvedValueOnce([{} as Reserva, {} as Reserva]);
      await expect(r.service.excluir(1)).rejects.toThrow('tem 2 reserva(s)');
      expect(r.clientes.excluir).not.toHaveBeenCalled();
    });
  });
});
