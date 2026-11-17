import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CriarFornecedorDTO } from '@shared/dto/fornecedor.dto';
import type { Fornecedor, NovoFornecedor } from '@shared/models/entidades';
import { NaoEncontradoError, RegraNegocioError } from '../../../src/main/errors/ErroApp';
import type { VinculosFornecedor } from '../../../src/main/repositories/FornecedorRepository';
import {
  FornecedorService,
  type RepoFornecedoresCadastro
} from '../../../src/main/services/FornecedorService';
import { erroMysql, umFornecedor } from './dadosTeste';

const novo: CriarFornecedorDTO = {
  razaoSocial: 'Náutica Reparos Ltda',
  cnpj: '33445566000186',
  tipo: 'MANUTENCAO',
  telefone: '4832456789'
};

function criarRepo() {
  let itens: Fornecedor[] = [umFornecedor()];
  let proximoId = 2;
  const vinculos = new Map<number, VinculosFornecedor>();

  const repo = {
    criar: vi.fn(async (dados: NovoFornecedor) => {
      const criado = umFornecedor({ ...dados, id: proximoId++ });
      itens.push(criado);
      return criado;
    }),
    buscarPorId: vi.fn(async (id: number) => itens.find((f) => f.id === id) ?? null),
    buscarPorCnpj: vi.fn(async (cnpj: string) => itens.find((f) => f.cnpj === cnpj) ?? null),
    listarFiltrado: vi.fn(async () => itens),
    listarPorTipo: vi.fn(async (tipo) => itens.filter((f) => f.tipo === tipo)),
    atualizar: vi.fn(async (id: number, dados: Partial<NovoFornecedor>) => {
      const atual = itens.find((f) => f.id === id);
      if (!atual) return null;
      for (const [campo, valor] of Object.entries(dados)) {
        if (valor !== undefined) Object.assign(atual, { [campo]: valor });
      }
      return { ...atual };
    }),
    excluir: vi.fn(async (id: number) => {
      itens = itens.filter((f) => f.id !== id);
      return true;
    }),
    contarVinculos: vi.fn(
      async (id: number) => vinculos.get(id) ?? { equipamentos: 0, manutencoes: 0 }
    )
  } satisfies RepoFornecedoresCadastro;

  return { repo, vinculos };
}

describe('FornecedorService', () => {
  let r: ReturnType<typeof criarRepo>;
  let service: FornecedorService;

  beforeEach(() => {
    r = criarRepo();
    service = new FornecedorService(r.repo);
  });

  describe('criar', () => {
    it('grava opcionais ausentes como null e devolve o DTO', async () => {
      const dto = await service.criar(novo);
      expect(r.repo.criar).toHaveBeenCalledWith({
        ...novo,
        contato: null,
        email: null
      });
      expect(dto).toMatchObject({ id: 2, tipo: 'MANUTENCAO', contato: undefined });
    });

    it('recusa CNPJ já cadastrado', async () => {
      await expect(service.criar({ ...novo, cnpj: '11222333000181' })).rejects.toThrow(
        'Já existe um fornecedor cadastrado com este CNPJ.'
      );
      expect(r.repo.criar).not.toHaveBeenCalled();
    });

    it('traduz o UNIQUE do banco (dois cadastros ao mesmo tempo)', async () => {
      r.repo.criar.mockRejectedValueOnce(erroMysql('ER_DUP_ENTRY'));
      await expect(service.criar(novo)).rejects.toThrow(RegraNegocioError);
    });
  });

  describe('listar', () => {
    it('repassa o filtro e converte null em ausente', async () => {
      const lista = await service.listar({ tipo: 'COMPRA', busca: 'esporte' });
      expect(r.repo.listarFiltrado).toHaveBeenCalledWith({ tipo: 'COMPRA', busca: 'esporte' });
      expect(lista[0]).not.toHaveProperty('contato', null);
    });

    it('lista por tipo (abas e selects)', async () => {
      await service.criar(novo);
      const prestadores = await service.listarPorTipo('MANUTENCAO');
      expect(prestadores.map((f) => f.razaoSocial)).toEqual(['Náutica Reparos Ltda']);
    });
  });

  describe('atualizar', () => {
    it('permite manter o próprio CNPJ', async () => {
      const dto = await service.atualizar({ id: 1, cnpj: '11222333000181', contato: 'Marcos' });
      expect(dto.contato).toBe('Marcos');
    });

    it('recusa CNPJ de outro fornecedor', async () => {
      await service.criar(novo);
      await expect(service.atualizar({ id: 2, cnpj: '11222333000181' })).rejects.toThrow(
        RegraNegocioError
      );
    });

    it('permite mudar o tipo de quem não tem vínculos', async () => {
      const dto = await service.atualizar({ id: 1, tipo: 'MANUTENCAO' });
      expect(dto.tipo).toBe('MANUTENCAO');
    });

    it('não muda o tipo de quem já tem equipamentos ou manutenções', async () => {
      r.vinculos.set(1, { equipamentos: 2, manutencoes: 0 });
      await expect(service.atualizar({ id: 1, tipo: 'MANUTENCAO' })).rejects.toThrow(
        'Não é possível mudar o tipo: o fornecedor já tem 2 equipamento(s) vinculado(s).'
      );
      expect(r.repo.atualizar).not.toHaveBeenCalled();
    });

    it('enviar o mesmo tipo não consulta vínculos', async () => {
      r.vinculos.set(1, { equipamentos: 2, manutencoes: 0 });
      await service.atualizar({ id: 1, tipo: 'COMPRA', razaoSocial: 'Outra Razão' });
      expect(r.repo.contarVinculos).not.toHaveBeenCalled();
    });

    it('opcional enviado vazio apaga; não enviado mantém', async () => {
      await service.atualizar({ id: 1, email: undefined });
      expect(r.repo.atualizar).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({ email: null, contato: undefined, telefone: undefined })
      );
    });

    it('avisa quando o fornecedor não existe', async () => {
      await expect(service.atualizar({ id: 99, contato: 'X' })).rejects.toThrow(NaoEncontradoError);
    });
  });

  describe('excluir', () => {
    it('exclui fornecedor sem vínculos', async () => {
      await service.excluir(1);
      expect(r.repo.excluir).toHaveBeenCalledWith(1);
    });

    it('não exclui quem tem equipamentos e manutenções e diz quantos', async () => {
      r.vinculos.set(1, { equipamentos: 3, manutencoes: 1 });
      await expect(service.excluir(1)).rejects.toThrow(
        'Não é possível excluir "Esporte Total Distribuidora Ltda": ele tem 3 equipamento(s) e 1 manutenção(ões) vinculado(s).'
      );
      expect(r.repo.excluir).not.toHaveBeenCalled();
    });

    it('traduz a FK do banco', async () => {
      r.repo.excluir.mockRejectedValueOnce(erroMysql('ER_ROW_IS_REFERENCED_2'));
      await expect(service.excluir(1)).rejects.toThrow('registros vinculados');
    });

    it('avisa quando o fornecedor não existe', async () => {
      await expect(service.excluir(99)).rejects.toThrow(NaoEncontradoError);
    });
  });
});
