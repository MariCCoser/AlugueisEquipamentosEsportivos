import { describe, expect, it } from 'vitest';
import { ValidacaoError } from '../../../../src/main/errors/ErroApp';
import {
  atualizarCategoriaSchema,
  criarCategoriaSchema
} from '../../../../src/main/security/validators/categoria.schema';
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

describe('criarCategoriaSchema', () => {
  it('limpa espaços, transforma descrição vazia em ausente e desliga o alerta por padrão', () => {
    expect(Validador.validar(criarCategoriaSchema, { nome: '  Caiaques ', descricao: '' })).toEqual(
      { nome: 'Caiaques', descricao: undefined, sensivelClima: false }
    );
  });

  it('exige nome com pelo menos 2 letras', () => {
    expect(errosDe(criarCategoriaSchema, { nome: '   ' }).nome).toBe('Nome é obrigatório.');
    expect(errosDe(criarCategoriaSchema, { nome: 'A' }).nome).toBe(
      'Nome deve ter pelo menos 2 letras.'
    );
  });

  it('respeita os tamanhos das colunas', () => {
    const erros = errosDe(criarCategoriaSchema, {
      nome: 'x'.repeat(61),
      descricao: 'y'.repeat(256)
    });
    expect(erros.nome).toContain('60');
    expect(erros.descricao).toContain('255');
  });

  it('recusa alerta de clima que não seja sim/não', () => {
    expect(errosDe(criarCategoriaSchema, { nome: 'Bolas', sensivelClima: 'sim' })).toHaveProperty(
      'sensivelClima'
    );
  });

  it('descarta campos extras mandados pela tela', () => {
    const dados = Validador.validar(criarCategoriaSchema, { nome: 'Bolas', id: 5, admin: true });
    expect(dados).not.toHaveProperty('id');
    expect(dados).not.toHaveProperty('admin');
  });
});

describe('atualizarCategoriaSchema', () => {
  it('exige um id válido', () => {
    expect(errosDe(atualizarCategoriaSchema, { id: 0, nome: 'Bolas' })).toHaveProperty('id');
  });

  it('aceita alterar um campo só', () => {
    expect(Validador.validar(atualizarCategoriaSchema, { id: 3, sensivelClima: true })).toEqual({
      id: 3,
      sensivelClima: true
    });
  });

  it('mantém a chave da descrição enviada vazia (para o service apagar)', () => {
    const dados = Validador.validar(atualizarCategoriaSchema, { id: 3, descricao: '' });
    expect('descricao' in dados).toBe(true);
    expect(dados.descricao).toBeUndefined();
  });
});
