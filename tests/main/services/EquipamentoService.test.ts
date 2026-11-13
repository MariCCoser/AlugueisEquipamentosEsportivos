import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CriarEquipamentoDTO } from '@shared/dto/equipamento.dto';
import type { Equipamento, Fornecedor } from '@shared/models/entidades';
import {
  NaoEncontradoError,
  RegraNegocioError,
  ValidacaoError
} from '../../../src/main/errors/ErroApp';
import { EquipamentoService } from '../../../src/main/services/EquipamentoService';
import { erroMysql, umaCategoria, umEquipamento, umFornecedor } from './dadosTeste';

const novaBike: CriarEquipamentoDTO = {
  nome: ' Bike Nova ',
  modalidade: 'LOCACAO',
  estadoConservacao: 'NOVO',
  valorDiaria: 50,
  categoriaId: 1,
  fornecedorId: 1
};

const oficina = umFornecedor({ id: 3, razaoSocial: 'Bike Reparos Oficina ME', tipo: 'MANUTENCAO' });

function montar() {
  let estoque: Equipamento[] = [
    umEquipamento({ id: 1 }),
    umEquipamento({ id: 2, nome: 'Bike Urbana', estadoConservacao: 'MEDIO' }),
    umEquipamento({ id: 3, nome: 'Bike Speed', status: 'RESERVADO' })
  ];
  const equipamentos = {
    criar: vi.fn(async (novo) => umEquipamento({ ...novo, id: 10 }) as Equipamento),
    buscarPorId: vi.fn(async (id: number) => estoque.find((e) => e.id === id) ?? null),
    filtrar: vi.fn(async () => estoque),
    atualizar: vi.fn(async (id: number, dados) => {
      const atual = estoque.find((e) => e.id === id);
      return atual ? ({ ...atual, ...dados } as Equipamento) : null;
    }),
    excluir: vi.fn(async () => true),
    atualizarStatus: vi.fn(async () => true)
  };
  const categorias = {
    buscarPorId: vi.fn(async (id: number) => (id === 1 ? umaCategoria() : null)),
    listar: vi.fn(async () => [umaCategoria()])
  };
  const fornecedores = {
    buscarPorId: vi.fn(async (id: number): Promise<Fornecedor | null> =>
      id === 1 ? umFornecedor() : id === 3 ? oficina : null
    ),
    listarPorTipo: vi.fn(async () => [umFornecedor()])
  };
  const disponibilidade = {
    filtrarDisponiveis: vi.fn(async (lista: Equipamento[]) => lista.slice(0, 1))
  };
  return {
    equipamentos,
    categorias,
    fornecedores,
    disponibilidade,
    trocarEstoque: (novo: Equipamento[]) => (estoque = novo),
    service: new EquipamentoService(equipamentos, categorias, fornecedores, disponibilidade)
  };
}

describe('EquipamentoService', () => {
  let m: ReturnType<typeof montar>;
  beforeEach(() => {
    m = montar();
  });

  describe('criar', () => {
    it('grava DISPONIVEL e devolve nomes de categoria e fornecedor', async () => {
      const dto = await m.service.criar(novaBike);
      expect(m.equipamentos.criar).toHaveBeenCalledWith(
        expect.objectContaining({ nome: 'Bike Nova', status: 'DISPONIVEL', precoVenda: null })
      );
      expect(dto).toMatchObject({
        id: 10,
        categoriaNome: 'Bicicletas',
        sensivelClima: true,
        fornecedorNome: 'Esporte Total Distribuidora Ltda'
      });
    });

    it('locação sem diária é inválida', async () => {
      await expect(m.service.criar({ ...novaBike, valorDiaria: undefined })).rejects.toThrow(
        ValidacaoError
      );
    });

    it('fornecedor precisa ser de COMPRA', async () => {
      await expect(m.service.criar({ ...novaBike, fornecedorId: 3 })).rejects.toThrow(
        'é prestador de manutenção'
      );
    });

    it('categoria e fornecedor precisam existir', async () => {
      await expect(m.service.criar({ ...novaBike, categoriaId: 99 })).rejects.toThrow(
        'Categoria não encontrada.'
      );
      await expect(m.service.criar({ ...novaBike, fornecedorId: 99 })).rejects.toThrow(
        'Fornecedor não encontrado.'
      );
    });
  });

  describe('listar', () => {
    it('repassa os filtros ao banco e filtra conservação em memória', async () => {
      const pagina = await m.service.listar({
        modalidade: 'LOCACAO',
        estadoConservacao: 'MEDIO',
        busca: 'bike'
      });
      expect(m.equipamentos.filtrar).toHaveBeenCalledWith({
        status: undefined,
        modalidade: 'LOCACAO',
        categoriaId: undefined,
        nome: 'bike'
      });
      expect(pagina.itens.map((e) => e.id)).toEqual([2]);
      expect(pagina.total).toBe(1);
    });

    it('busca nomes de categoria/fornecedor uma vez só para a página inteira', async () => {
      await m.service.listar();
      expect(m.categorias.listar).toHaveBeenCalledTimes(1);
      expect(m.fornecedores.listarPorTipo).toHaveBeenCalledTimes(1);
    });
  });

  describe('atualizar', () => {
    it('valida o preço com os dados finais (modalidade nova + preço atual)', async () => {
      await expect(m.service.atualizar({ id: 1, modalidade: 'VENDA' })).rejects.toThrow(
        ValidacaoError
      );
      await expect(
        m.service.atualizar({ id: 1, modalidade: 'VENDA', precoVenda: 900 })
      ).resolves.toMatchObject({ modalidade: 'VENDA', precoVenda: 900 });
    });

    it('não muda a modalidade de item reservado', async () => {
      await expect(
        m.service.atualizar({ id: 3, modalidade: 'VENDA', precoVenda: 900 })
      ).rejects.toThrow(RegraNegocioError);
    });

    it('nunca grava status, mesmo se vier da tela', async () => {
      await m.service.atualizar({ id: 1, nome: 'X', status: 'DISPONIVEL' } as never);
      expect(m.equipamentos.atualizar).toHaveBeenCalledWith(1, { nome: 'X' });
    });

    it('inexistente lança NaoEncontrado', async () => {
      await expect(m.service.atualizar({ id: 99, nome: 'X' })).rejects.toThrow(NaoEncontradoError);
    });
  });

  it('excluir com histórico vira mensagem orientando INDISPONIVEL', async () => {
    m.equipamentos.excluir.mockRejectedValueOnce(erroMysql('ER_ROW_IS_REFERENCED_2'));
    await expect(m.service.excluir(1)).rejects.toThrow('Marque-o como INDISPONIVEL.');
  });

  describe('alterarStatus', () => {
    it('troca DISPONIVEL <-> INDISPONIVEL', async () => {
      const dto = await m.service.alterarStatus({ id: 1, status: 'INDISPONIVEL' });
      expect(dto.status).toBe('INDISPONIVEL');
      expect(m.equipamentos.atualizarStatus).toHaveBeenCalledWith(1, 'INDISPONIVEL');
    });

    it('não mexe em item reservado ou em manutenção', async () => {
      await expect(m.service.alterarStatus({ id: 3, status: 'INDISPONIVEL' })).rejects.toThrow(
        'volta a ficar disponível na devolução'
      );
      m.trocarEstoque([umEquipamento({ id: 4, status: 'EM_MANUTENCAO' })]);
      await expect(m.service.alterarStatus({ id: 4, status: 'DISPONIVEL' })).rejects.toThrow(
        'registre o retorno da manutenção'
      );
    });

    it('recusa status que não é manual', async () => {
      await expect(
        m.service.alterarStatus({ id: 1, status: 'RESERVADO' } as never)
      ).rejects.toThrow(ValidacaoError);
    });
  });

  it('listarDisponiveis busca só LOCACAO da categoria e filtra pela disponibilidade', async () => {
    const livres = await m.service.listarDisponiveis({
      dataRetirada: '2026-11-20',
      dataDevolucaoPrevista: '2026-11-22',
      categoriaId: 1
    });
    expect(m.equipamentos.filtrar).toHaveBeenCalledWith({ modalidade: 'LOCACAO', categoriaId: 1 });
    expect(livres.map((e) => e.id)).toEqual([1]);
  });
});
