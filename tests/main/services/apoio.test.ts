import { describe, expect, it } from 'vitest';
import { RegraNegocioError, ValidacaoError } from '../../../src/main/errors/DominioError';
import { TradutorErroBanco } from '../../../src/main/errors/TradutorErroBanco';
import { ClienteMapper } from '../../../src/main/services/mapeadores/ClienteMapper';
import { Paginador } from '../../../src/main/services/Paginador';
import { erroMysql } from './dadosTeste';

describe('TradutorErroBanco', () => {
  it('FK em uso vira RegraNegocio com a mensagem do service', () => {
    const erro = TradutorErroBanco.traduzir(erroMysql('ER_ROW_IS_REFERENCED_2'), {
      emUso: 'Tem reservas.'
    });
    expect(erro).toBeInstanceOf(RegraNegocioError);
    expect((erro as Error).message).toBe('Tem reservas.');
  });

  it('duplicado e referência inexistente têm mensagens padrão', () => {
    expect(TradutorErroBanco.traduzir(erroMysql('ER_DUP_ENTRY'))).toBeInstanceOf(RegraNegocioError);
    expect(TradutorErroBanco.traduzir(erroMysql('ER_NO_REFERENCED_ROW_2'))).toBeInstanceOf(
      ValidacaoError
    );
  });

  it('erro desconhecido passa intacto (vira INTERNO no IPC)', () => {
    const original = erroMysql('ECONNREFUSED');
    expect(TradutorErroBanco.traduzir(original)).toBe(original);
    expect(TradutorErroBanco.traduzir('texto')).toBe('texto');
  });

  it('proteger devolve o resultado ou lança traduzido', async () => {
    await expect(TradutorErroBanco.proteger(async () => 42)).resolves.toBe(42);
    await expect(
      TradutorErroBanco.proteger(async () => {
        throw erroMysql('ER_DUP_ENTRY');
      })
    ).rejects.toBeInstanceOf(RegraNegocioError);
  });
});

describe('Paginador', () => {
  const itens = Array.from({ length: 45 }, (_, i) => i + 1);

  it('padrão: página 1 com 20 itens', () => {
    const p = Paginador.paginar(itens);
    expect(p).toMatchObject({ total: 45, pagina: 1, porPagina: 20 });
    expect(p.itens).toHaveLength(20);
  });

  it('última página vem incompleta', () => {
    expect(Paginador.paginar(itens, { pagina: 3 }).itens).toEqual([41, 42, 43, 44, 45]);
  });

  it('corrige valores fora dos limites', () => {
    expect(Paginador.paginar(itens, { pagina: -2, porPagina: 1000 })).toMatchObject({
      pagina: 1,
      porPagina: 100
    });
    expect(Paginador.limite(0)).toBe(20);
  });
});

describe('ClienteMapper', () => {
  it('mascara o CPF (LGPD)', () => {
    expect(ClienteMapper.mascararCpf('52998224725')).toBe('***.982.247-**');
    expect(ClienteMapper.mascararCpf('123')).toBe('***.***.***-**');
  });

  it('na edição converte só os campos enviados', () => {
    expect(ClienteMapper.paraAtualizacao({ uf: 'rj', complemento: ' ' })).toEqual({
      uf: 'RJ',
      complemento: null
    });
  });
});
