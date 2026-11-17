import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Categoria, NovaCategoria } from '@shared/models/entidades';
import { NaoEncontradoError, RegraNegocioError } from '../../../src/main/errors/ErroApp';
import { CategoriaService, type RepoCategorias } from '../../../src/main/services/CategoriaService';
import { erroMysql, umaCategoria } from './dadosTeste';

/**
 * Repositório em memória. `buscarPorNome` ignora maiúsculas e acentos,
 * imitando a collation utf8mb4_unicode_ci do MySQL.
 */
function criarRepo(iniciais: Categoria[] = [umaCategoria()]) {
  let itens = [...iniciais];
  let proximoId = Math.max(0, ...itens.map((c) => c.id)) + 1;
  const usoPorCategoria = new Map<number, number>();
  const normalizar = (texto: string) =>
    texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

  const repo = {
    criar: vi.fn(async (nova: NovaCategoria) => {
      const criada = umaCategoria({
        id: proximoId++,
        nome: nova.nome,
        descricao: nova.descricao ?? null,
        sensivelClima: nova.sensivelClima ?? false
      });
      itens.push(criada);
      return criada;
    }),
    buscarPorId: vi.fn(async (id: number) => itens.find((c) => c.id === id) ?? null),
    buscarPorNome: vi.fn(
      async (nome: string) => itens.find((c) => normalizar(c.nome) === normalizar(nome)) ?? null
    ),
    listarComUso: vi.fn(async () =>
      [...itens]
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((c) => ({ ...c, qtdEquipamentos: usoPorCategoria.get(c.id) ?? 0 }))
    ),
    atualizar: vi.fn(async (id: number, dados: Partial<NovaCategoria>) => {
      const atual = itens.find((c) => c.id === id);
      if (!atual) return null;
      const definidos = Object.fromEntries(
        Object.entries(dados).filter(([, valor]) => valor !== undefined)
      );
      Object.assign(atual, definidos);
      return { ...atual };
    }),
    excluir: vi.fn(async (id: number) => {
      const antes = itens.length;
      itens = itens.filter((c) => c.id !== id);
      return itens.length < antes;
    }),
    contarEquipamentos: vi.fn(async (id: number) => usoPorCategoria.get(id) ?? 0)
  } satisfies RepoCategorias;

  return { repo, usoPorCategoria };
}

describe('CategoriaService', () => {
  let r: ReturnType<typeof criarRepo>;
  let service: CategoriaService;

  beforeEach(() => {
    r = criarRepo();
    service = new CategoriaService(r.repo);
  });

  describe('criar', () => {
    it('cria e devolve o DTO sem equipamentos', async () => {
      const dto = await service.criar({ nome: 'Caiaques', sensivelClima: true });
      expect(dto).toEqual({
        id: 2,
        nome: 'Caiaques',
        descricao: undefined,
        sensivelClima: true,
        qtdEquipamentos: 0
      });
    });

    it('grava descrição ausente como null e alerta de clima desligado por padrão', async () => {
      await service.criar({ nome: 'Bolas' });
      expect(r.repo.criar).toHaveBeenCalledWith({
        nome: 'Bolas',
        descricao: null,
        sensivelClima: false
      });
    });

    it('recusa nome repetido sem diferenciar maiúsculas e acentos', async () => {
      await expect(service.criar({ nome: 'BICICLÉTAS' })).rejects.toThrow(
        'Já existe uma categoria com esse nome.'
      );
      expect(r.repo.criar).not.toHaveBeenCalled();
    });

    it('traduz o UNIQUE do banco (dois cadastros ao mesmo tempo)', async () => {
      r.repo.criar.mockRejectedValueOnce(erroMysql('ER_DUP_ENTRY'));
      await expect(service.criar({ nome: 'Patins' })).rejects.toThrow(RegraNegocioError);
    });
  });

  describe('listar e buscar', () => {
    it('lista em ordem alfabética com a quantidade de equipamentos', async () => {
      await service.criar({ nome: 'Arcos' });
      r.usoPorCategoria.set(1, 4);
      const lista = await service.listar();
      expect(lista.map((c) => [c.nome, c.qtdEquipamentos])).toEqual([
        ['Arcos', 0],
        ['Bicicletas', 4]
      ]);
    });

    it('busca por id com a quantidade de equipamentos', async () => {
      r.usoPorCategoria.set(1, 2);
      expect((await service.buscarPorId(1)).qtdEquipamentos).toBe(2);
    });

    it('avisa quando a categoria não existe', async () => {
      await expect(service.buscarPorId(99)).rejects.toThrow(NaoEncontradoError);
    });
  });

  describe('atualizar', () => {
    it('altera só os campos enviados', async () => {
      const dto = await service.atualizar({ id: 1, sensivelClima: false });
      expect(dto.nome).toBe('Bicicletas');
      expect(dto.sensivelClima).toBe(false);
    });

    it('permite manter o próprio nome (inclusive mudando maiúsculas)', async () => {
      const dto = await service.atualizar({ id: 1, nome: 'BICICLETAS' });
      expect(dto.nome).toBe('BICICLETAS');
    });

    it('recusa nome de outra categoria', async () => {
      await service.criar({ nome: 'Pranchas' });
      await expect(service.atualizar({ id: 2, nome: 'bicicletas' })).rejects.toThrow(
        RegraNegocioError
      );
    });

    it('descrição enviada vazia apaga a descrição', async () => {
      await service.atualizar({ id: 1, descricao: 'Mountain bike' });
      await service.atualizar({ id: 1, descricao: undefined });
      expect(r.repo.atualizar).toHaveBeenLastCalledWith(1, {
        nome: undefined,
        sensivelClima: undefined,
        descricao: null
      });
    });

    it('descrição não enviada é mantida', async () => {
      await service.atualizar({ id: 1, nome: 'Bikes' });
      expect(r.repo.atualizar).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({ descricao: undefined })
      );
    });

    it('avisa quando a categoria não existe', async () => {
      await expect(service.atualizar({ id: 99, nome: 'X' })).rejects.toThrow(NaoEncontradoError);
    });
  });

  describe('excluir', () => {
    it('exclui categoria sem equipamentos', async () => {
      await service.excluir(1);
      expect(r.repo.excluir).toHaveBeenCalledWith(1);
    });

    it('não exclui categoria com equipamentos e diz quantos', async () => {
      r.usoPorCategoria.set(1, 3);
      await expect(service.excluir(1)).rejects.toThrow(
        'Não é possível excluir "Bicicletas": 3 equipamento(s) usam esta categoria.'
      );
      expect(r.repo.excluir).not.toHaveBeenCalled();
    });

    it('traduz a FK do banco (equipamento cadastrado no meio do caminho)', async () => {
      r.repo.excluir.mockRejectedValueOnce(erroMysql('ER_ROW_IS_REFERENCED_2'));
      await expect(service.excluir(1)).rejects.toThrow('existem equipamentos nesta categoria');
    });

    it('avisa quando a categoria não existe', async () => {
      await expect(service.excluir(99)).rejects.toThrow(NaoEncontradoError);
    });
  });
});
