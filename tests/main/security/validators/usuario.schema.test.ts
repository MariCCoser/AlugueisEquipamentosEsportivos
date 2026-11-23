import { describe, expect, it } from 'vitest';
import { ValidacaoError } from '../../../../src/main/errors/ErroApp';
import {
  alterarSenhaSchema,
  atualizarUsuarioSchema,
  criarUsuarioSchema,
  filtroUsuarioSchema,
  loginSchema
} from '../../../../src/main/security/validators/usuario.schema';
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

describe('loginSchema', () => {
  it('padroniza o e-mail (sem espaços, minúsculo) e mantém a senha como veio', () => {
    expect(
      Validador.validar(loginSchema, { email: ' Admin@Aluguel.LOCAL ', senha: ' a b ' })
    ).toEqual({ email: 'admin@aluguel.local', senha: ' a b ' });
  });

  it('marca os campos vazios para a tela (erro.campos.email / erro.campos.senha)', () => {
    expect(errosDe(loginSchema, { email: '', senha: '' })).toEqual({
      email: 'E-mail é obrigatório.',
      senha: 'Senha é obrigatória.'
    });
  });

  it('recusa e-mail mal escrito e entrada que não é objeto', () => {
    expect(errosDe(loginSchema, { email: 'admin', senha: 'x' })).toHaveProperty('email');
    expect(errosDe(loginSchema, null)).toHaveProperty('entrada');
  });

  it('descarta campos extras mandados pela tela (ex.: perfil)', () => {
    const dados = Validador.validar(loginSchema, {
      email: 'a@b.com',
      senha: 'x',
      perfil: 'ADMIN'
    });
    expect(dados).not.toHaveProperty('perfil');
  });
});

describe('alterarSenhaSchema', () => {
  it('exige a senha atual e nova senha com pelo menos 8 caracteres', () => {
    expect(errosDe(alterarSenhaSchema, { senhaAtual: '', novaSenha: '1234567' })).toEqual({
      senhaAtual: 'Senha atual é obrigatória.',
      novaSenha: 'A senha precisa ter pelo menos 8 caracteres.'
    });
  });

  it('recusa senha com mais de 72 caracteres (limite do bcrypt)', () => {
    const erros = errosDe(alterarSenhaSchema, { senhaAtual: 'x', novaSenha: 'a'.repeat(73) });
    expect(erros['novaSenha']).toContain('72');
  });
});

describe('criarUsuarioSchema', () => {
  const valido = {
    nome: ' Pedro Alves ',
    email: 'Pedro@Loja.com',
    senha: 'Senha@123',
    perfil: 'FUNCIONARIO'
  };

  it('aceita dados válidos já padronizados', () => {
    expect(Validador.validar(criarUsuarioSchema, valido)).toEqual({
      nome: 'Pedro Alves',
      email: 'pedro@loja.com',
      senha: 'Senha@123',
      perfil: 'FUNCIONARIO'
    });
  });

  it('recusa perfil desconhecido e senha curta', () => {
    const erros = errosDe(criarUsuarioSchema, { ...valido, perfil: 'DONO', senha: '123' });
    expect(erros['perfil']).toBe('Perfil deve ser ADMIN ou FUNCIONARIO.');
    expect(erros['senha']).toBe('A senha precisa ter pelo menos 8 caracteres.');
  });

  it('respeita o tamanho das colunas (nome 100, e-mail 150)', () => {
    const erros = errosDe(criarUsuarioSchema, {
      ...valido,
      nome: 'a'.repeat(101),
      email: `${'a'.repeat(145)}@b.com`
    });
    expect(Object.keys(erros).sort()).toEqual(['email', 'nome']);
  });
});

describe('atualizarUsuarioSchema', () => {
  it('só o id é obrigatório; novaSenha vazia vira "não trocar"', () => {
    expect(
      Validador.validar(atualizarUsuarioSchema, { id: 3, ativo: false, novaSenha: '' })
    ).toEqual({ id: 3, ativo: false, novaSenha: undefined });
  });

  it('nova senha preenchida segue a regra de 8 caracteres', () => {
    expect(errosDe(atualizarUsuarioSchema, { id: 3, novaSenha: 'curta' })).toHaveProperty(
      'novaSenha'
    );
  });

  it('recusa id inválido e ativo que não é booleano', () => {
    const erros = errosDe(atualizarUsuarioSchema, { id: 0, ativo: 'sim' });
    expect(Object.keys(erros).sort()).toEqual(['ativo', 'id']);
  });
});

describe('filtroUsuarioSchema', () => {
  it('sem filtro devolve objeto vazio', () => {
    expect(Validador.validar(filtroUsuarioSchema, undefined)).toEqual({});
  });

  it('aceita perfil, ativo e busca', () => {
    expect(
      Validador.validar(filtroUsuarioSchema, { perfil: 'ADMIN', ativo: true, busca: ' ana ' })
    ).toEqual({ perfil: 'ADMIN', ativo: true, busca: 'ana' });
  });
});
