import { describe, expect, it } from 'vitest';
import { ValidacaoError } from '../../../../src/main/errors/ErroApp';
import {
  atualizarFornecedorSchema,
  criarFornecedorSchema,
  filtroFornecedorSchema,
  tipoFornecedorSchema
} from '../../../../src/main/security/validators/fornecedor.schema';
import { Validador } from '../../../../src/main/security/validators/Validador';

function errosDe(schema: Parameters<typeof Validador.validar>[0], entrada: unknown) {
  try {
    Validador.validar(schema, entrada);
  } catch (erro) {
    expect(erro).toBeInstanceOf(ValidacaoError);
    return (erro as ValidacaoError).campos ?? {};
  }
  throw new Error('era esperado erro de validação');
}

const valido = {
  razaoSocial: '  Esporte Total Ltda ',
  cnpj: '11.222.333/0001-81',
  tipo: 'COMPRA',
  contato: '',
  telefone: '(11) 3333-4444',
  email: 'vendas@esportetotal.com'
};

describe('criarFornecedorSchema', () => {
  it('limpa espaços, guarda só os dígitos e transforma opcionais vazios em ausentes', () => {
    expect(Validador.validar(criarFornecedorSchema, valido)).toEqual({
      razaoSocial: 'Esporte Total Ltda',
      cnpj: '11222333000181',
      tipo: 'COMPRA',
      contato: undefined,
      telefone: '1133334444',
      email: 'vendas@esportetotal.com'
    });
  });

  it('aceita telefone e e-mail em branco', () => {
    const dados = Validador.validar(criarFornecedorSchema, { ...valido, telefone: '', email: '' });
    expect(dados.telefone).toBeUndefined();
    expect(dados.email).toBeUndefined();
  });

  it('recusa CNPJ com dígito verificador errado', () => {
    expect(errosDe(criarFornecedorSchema, { ...valido, cnpj: '11222333000182' }).cnpj).toBe(
      'CNPJ inválido: confira os números.'
    );
  });

  it('recusa CNPJ com tamanho errado', () => {
    expect(errosDe(criarFornecedorSchema, { ...valido, cnpj: '1122233300' }).cnpj).toBe(
      'CNPJ deve ter 14 dígitos.'
    );
  });

  it('recusa tipo fora do enum', () => {
    expect(errosDe(criarFornecedorSchema, { ...valido, tipo: 'VENDA' }).tipo).toBe(
      'Tipo deve ser COMPRA ou MANUTENCAO.'
    );
  });

  it('recusa telefone e e-mail mal formatados', () => {
    const erros = errosDe(criarFornecedorSchema, { ...valido, telefone: '1234', email: 'x@' });
    expect(erros).toHaveProperty('telefone');
    expect(erros.email).toBe('E-mail inválido.');
  });

  it('exige razão social', () => {
    expect(errosDe(criarFornecedorSchema, { ...valido, razaoSocial: ' ' }).razaoSocial).toBe(
      'Razão social é obrigatório.'
    );
  });

  it('descarta campos extras mandados pela tela', () => {
    const dados = Validador.validar(criarFornecedorSchema, { ...valido, id: 9, ativo: false });
    expect(dados).not.toHaveProperty('id');
    expect(dados).not.toHaveProperty('ativo');
  });
});

describe('atualizarFornecedorSchema', () => {
  it('aceita alterar um campo só', () => {
    expect(Validador.validar(atualizarFornecedorSchema, { id: 2, tipo: 'MANUTENCAO' })).toEqual({
      id: 2,
      tipo: 'MANUTENCAO'
    });
  });

  it('valida o CNPJ quando ele é enviado', () => {
    expect(errosDe(atualizarFornecedorSchema, { id: 2, cnpj: '00000000000000' })).toHaveProperty(
      'cnpj'
    );
  });
});

describe('filtros', () => {
  it('filtro vazio vira objeto vazio', () => {
    expect(Validador.validar(filtroFornecedorSchema, undefined)).toEqual({});
  });

  it('listarPorTipo exige um tipo válido', () => {
    expect(Validador.validar(tipoFornecedorSchema, { tipo: 'COMPRA' })).toEqual({ tipo: 'COMPRA' });
    expect(errosDe(tipoFornecedorSchema, {})).toHaveProperty('tipo');
  });
});
