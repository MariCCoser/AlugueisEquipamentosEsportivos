import type { IdDTO } from '@shared/dto';
import type {
  AtualizarFornecedorDTO,
  CriarFornecedorDTO,
  FiltroFornecedorDTO,
  FornecedorDTO,
  TipoFornecedorDTO
} from '@shared/dto/fornecedor.dto';
import { cnpjValido, somenteDigitos } from '@shared/validadores/cnpj';
import { ErroSimulado, type Simulacao } from '../apiSimulada';

/**
 * Fornecedores em memória (só em desenvolvimento), com os mesmos dados do seed
 * e as principais regras do FornecedorService: CNPJ válido e único, e não
 * excluir nem mudar o tipo de quem tem equipamentos ou manutenções.
 */
export function simularFornecedores(): Simulacao {
  let proximoId = 5;
  let fornecedores: FornecedorDTO[] = [
    {
      id: 1,
      razaoSocial: 'Esporte Total Distribuidora Ltda',
      cnpj: '11222333000181',
      tipo: 'COMPRA',
      contato: 'Marcos',
      telefone: '1133334444',
      email: 'vendas@esportetotal.com'
    },
    {
      id: 2,
      razaoSocial: 'Aventura Equipamentos Ltda',
      cnpj: '45678901000175',
      tipo: 'COMPRA',
      contato: 'Juliana',
      telefone: '4833221100',
      email: 'contato@aventura.com'
    },
    {
      id: 3,
      razaoSocial: 'Bike Reparos Oficina ME',
      cnpj: '77889900000166',
      tipo: 'MANUTENCAO',
      contato: 'Rafael',
      telefone: '1132109876',
      email: 'oficina@bikereparos.com'
    },
    {
      id: 4,
      razaoSocial: 'Náutica Reparos Ltda',
      cnpj: '33445566000186',
      tipo: 'MANUTENCAO',
      contato: 'Paula',
      telefone: '4832456789',
      email: 'servicos@nauticareparos.com'
    }
  ];
  /** Fornecedores 1 e 3 têm registros vinculados (como no seed). */
  const comVinculos = new Set([1, 3]);

  const obter = (id: number): FornecedorDTO => {
    const fornecedor = fornecedores.find((f) => f.id === id);
    if (!fornecedor) {
      throw new ErroSimulado({
        codigo: 'NAO_ENCONTRADO',
        mensagem: `Fornecedor #${id} não encontrado(a).`
      });
    }
    return fornecedor;
  };

  const validar = (dados: Partial<CriarFornecedorDTO>, idAtual?: number): void => {
    const campos: Record<string, string> = {};
    if (dados.razaoSocial !== undefined && dados.razaoSocial.trim().length < 3) {
      campos['razaoSocial'] = 'Razão social deve ter pelo menos 3 letras.';
    }
    if (dados.cnpj !== undefined && !cnpjValido(dados.cnpj)) {
      campos['cnpj'] = 'CNPJ inválido: confira os números.';
    }
    if (Object.keys(campos).length > 0) {
      throw new ErroSimulado({
        codigo: 'VALIDACAO',
        mensagem: 'Dados inválidos. Confira os campos destacados.',
        campos
      });
    }
    const cnpj = dados.cnpj ? somenteDigitos(dados.cnpj) : undefined;
    const repetido = fornecedores.find((f) => f.cnpj === cnpj && f.id !== idAtual);
    if (repetido) {
      throw new ErroSimulado({
        codigo: 'REGRA_NEGOCIO',
        mensagem: 'Já existe um fornecedor cadastrado com este CNPJ.'
      });
    }
  };

  const limpar = (dados: Partial<CriarFornecedorDTO>): Partial<FornecedorDTO> => {
    const limpo: Partial<FornecedorDTO> = { ...dados };
    if (dados.cnpj !== undefined) limpo.cnpj = somenteDigitos(dados.cnpj);
    for (const campo of ['contato', 'telefone', 'email'] as const) {
      if (campo in dados) limpo[campo] = dados[campo]?.trim() || undefined;
    }
    return limpo;
  };

  return {
    listar: (filtro: FiltroFornecedorDTO = {}) => {
      const busca = filtro.busca?.toLowerCase() ?? '';
      const digitos = somenteDigitos(busca);
      return fornecedores
        .filter((f) => !filtro.tipo || f.tipo === filtro.tipo)
        .filter(
          (f) =>
            !busca ||
            f.razaoSocial.toLowerCase().includes(busca) ||
            (digitos !== '' && f.cnpj.startsWith(digitos))
        )
        .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial));
    },
    listarPorTipo: ({ tipo }: TipoFornecedorDTO) => fornecedores.filter((f) => f.tipo === tipo),
    buscarPorId: ({ id }: IdDTO) => obter(id),
    criar: (dados: CriarFornecedorDTO) => {
      validar(dados);
      const novo = { ...limpar(dados), id: proximoId++ } as FornecedorDTO;
      fornecedores.push(novo);
      return novo;
    },
    atualizar: ({ id, ...dados }: AtualizarFornecedorDTO) => {
      const atual = obter(id);
      validar(dados, id);
      if (dados.tipo && dados.tipo !== atual.tipo && comVinculos.has(id)) {
        throw new ErroSimulado({
          codigo: 'REGRA_NEGOCIO',
          mensagem:
            'Não é possível mudar o tipo: o fornecedor já tem 2 equipamento(s) vinculado(s).'
        });
      }
      Object.assign(atual, limpar(dados));
      return atual;
    },
    excluir: ({ id }: IdDTO) => {
      const atual = obter(id);
      if (comVinculos.has(id)) {
        throw new ErroSimulado({
          codigo: 'REGRA_NEGOCIO',
          mensagem: `Não é possível excluir "${atual.razaoSocial}": ele tem 2 equipamento(s) vinculado(s).`
        });
      }
      fornecedores = fornecedores.filter((f) => f.id !== id);
    }
  };
}
