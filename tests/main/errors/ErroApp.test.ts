import { describe, expect, it } from 'vitest';
import {
  ErroApp,
  IntegracaoError,
  NaoAutorizadoError,
  NaoEncontradoError,
  RegraNegocioError,
  ValidacaoError
} from '../../../src/main/errors/ErroApp';
import { EquipamentoIndisponivelError } from '../../../src/main/errors/ReservaErrors';

describe('ErroApp (hierarquia única de erros esperados)', () => {
  it.each([
    [new ValidacaoError('x'), 'VALIDACAO'],
    [new NaoEncontradoError('x'), 'NAO_ENCONTRADO'],
    [new RegraNegocioError('x'), 'REGRA_NEGOCIO'],
    [new NaoAutorizadoError('x'), 'NAO_AUTORIZADO'],
    [new IntegracaoError('x'), 'INTEGRACAO'],
    [new EquipamentoIndisponivelError('Bike', 'EM_MANUTENCAO'), 'REGRA_NEGOCIO']
  ])('%s tem o código certo e é ErroApp', (erro, codigo) => {
    expect(erro).toBeInstanceOf(ErroApp);
    expect(erro.codigo).toBe(codigo);
  });

  it('NaoEncontradoError aceita mensagem pronta ou entidade + id', () => {
    expect(new NaoEncontradoError('Reserva não encontrada.').message).toBe(
      'Reserva não encontrada.'
    );
    expect(new NaoEncontradoError('Cliente', 7).message).toBe('Cliente #7 não encontrado(a).');
  });

  it('ValidacaoError leva os campos do formulário', () => {
    expect(new ValidacaoError('Dados inválidos.', { cpf: 'CPF inválido' }).campos).toEqual({
      cpf: 'CPF inválido'
    });
    expect(new ValidacaoError('Só a mensagem.').campos).toBeUndefined();
  });

  it('o nome da classe aparece no erro (ajuda a ler o terminal)', () => {
    expect(new RegraNegocioError('x').name).toBe('RegraNegocioError');
  });
});
