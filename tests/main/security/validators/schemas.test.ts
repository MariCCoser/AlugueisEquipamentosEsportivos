import { describe, expect, it } from 'vitest';
import { ValidacaoError } from '../../../../src/main/errors/ErroApp';
import { idSchema } from '../../../../src/main/security/validators/campos.schema';
import {
  atualizarClienteSchema,
  criarClienteSchema,
  filtroClienteSchema
} from '../../../../src/main/security/validators/cliente.schema';
import {
  alterarStatusEquipamentoSchema,
  criarEquipamentoSchema,
  filtroEquipamentoSchema,
  verificarDisponibilidadeSchema
} from '../../../../src/main/security/validators/equipamento.schema';
import { Validador } from '../../../../src/main/security/validators/Validador';

/** Roda o validador e devolve os erros por campo (ou falha o teste se não houver erro). */
function errosDe(schema: Parameters<typeof Validador.validar>[0], entrada: unknown) {
  try {
    Validador.validar(schema, entrada);
  } catch (erro) {
    expect(erro).toBeInstanceOf(ValidacaoError);
    return (erro as ValidacaoError).campos ?? {};
  }
  throw new Error('era esperado erro de validação');
}

const clienteValido = {
  nome: ' Ana Souza ',
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

describe('schemas de cliente', () => {
  it('aceita dados com pontuação e devolve normalizados', () => {
    expect(Validador.validar(criarClienteSchema, clienteValido)).toEqual({
      nome: 'Ana Souza',
      cpf: '52998224725',
      telefone: '11987654321',
      email: undefined,
      cep: '01310100',
      rua: 'Avenida Paulista',
      numero: '1000',
      complemento: undefined,
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP'
    });
  });

  it('descarta campos que não existem no DTO', () => {
    const dados = Validador.validar(criarClienteSchema, { ...clienteValido, id: 99, admin: true });
    expect(dados).not.toHaveProperty('id');
    expect(dados).not.toHaveProperty('admin');
  });

  it('marca cada campo inválido com uma mensagem', () => {
    const erros = errosDe(criarClienteSchema, {
      ...clienteValido,
      nome: '   ',
      cpf: '123',
      email: 'nao-e-email',
      uf: 'São Paulo'
    });
    expect(erros).toEqual({
      nome: 'Nome é obrigatório.',
      cpf: 'CPF deve ter 11 dígitos.',
      email: 'E-mail inválido.',
      uf: 'UF deve ter 2 letras, ex.: SP.'
    });
  });

  it('entrada que nem é objeto é recusada', () => {
    expect(() => Validador.validar(criarClienteSchema, 'DROP TABLE')).toThrow(ValidacaoError);
  });

  it('edição exige id e aceita só alguns campos', () => {
    expect(Validador.validar(atualizarClienteSchema, { id: 1, uf: 'rj' })).toEqual({
      id: 1,
      uf: 'RJ'
    });
    expect(errosDe(atualizarClienteSchema, { uf: 'RJ' })).toHaveProperty('id');
  });

  it('filtro é opcional', () => {
    expect(Validador.validar(filtroClienteSchema, undefined)).toEqual({});
    expect(errosDe(filtroClienteSchema, { porPagina: 500 })).toHaveProperty('porPagina');
  });

  it('id precisa ser inteiro positivo', () => {
    expect(Validador.validar(idSchema, { id: 3 })).toEqual({ id: 3 });
    expect(errosDe(idSchema, { id: '3' })).toHaveProperty('id');
    expect(errosDe(idSchema, { id: -1 })).toHaveProperty('id');
  });
});

describe('schemas de equipamento', () => {
  const bike = {
    nome: 'Bike',
    modalidade: 'LOCACAO',
    estadoConservacao: 'NOVO',
    valorDiaria: 45.1,
    categoriaId: 1
  };

  it('aceita equipamento válido', () => {
    expect(Validador.validar(criarEquipamentoSchema, bike)).toMatchObject(bike);
  });

  it('valida enums, dinheiro e datas', () => {
    const erros = errosDe(criarEquipamentoSchema, {
      ...bike,
      modalidade: 'ALUGUEL',
      valorDiaria: 10.123,
      dataAquisicao: '2026-02-30'
    });
    expect(erros).toEqual({
      modalidade: 'Modalidade inválida.',
      valorDiaria: 'Valor da diária pode ter no máximo 2 casas decimais.',
      dataAquisicao: 'Data de aquisição inválida (use AAAA-MM-DD).'
    });
    expect(errosDe(criarEquipamentoSchema, { ...bike, valorDiaria: 0 })).toHaveProperty(
      'valorDiaria'
    );
  });

  it('o status não entra pelo cadastro', () => {
    const dados = Validador.validar(criarEquipamentoSchema, { ...bike, status: 'RESERVADO' });
    expect(dados).not.toHaveProperty('status');
  });

  it('filtro e disponibilidade', () => {
    expect(Validador.validar(filtroEquipamentoSchema, { status: 'DISPONIVEL' })).toEqual({
      status: 'DISPONIVEL'
    });
    expect(
      errosDe(verificarDisponibilidadeSchema, {
        equipamentoId: 1,
        dataRetirada: '20/11/2026',
        dataDevolucaoPrevista: '2026-11-22'
      })
    ).toHaveProperty('dataRetirada');
  });

  it('alterarStatus aceita só DISPONIVEL/INDISPONIVEL', () => {
    expect(errosDe(alterarStatusEquipamentoSchema, { id: 1, status: 'RESERVADO' })).toEqual({
      status: 'Só é possível marcar como DISPONIVEL ou INDISPONIVEL.'
    });
  });
});
