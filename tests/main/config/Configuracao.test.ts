import { describe, expect, it } from 'vitest';
import { Configuracao, ConfiguracaoError } from '../../../src/main/config/Configuracao';

const envValido = {
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_USER: 'app_aluguel',
  DB_PASSWORD: 'segredo',
  DB_NAME: 'aluguel_esportivo'
};

describe('Configuracao', () => {
  it('lê a configuração do banco', () => {
    expect(new Configuracao(envValido).banco()).toEqual({
      host: '127.0.0.1',
      port: 3306,
      user: 'app_aluguel',
      password: 'segredo',
      database: 'aluguel_esportivo',
      connectionLimit: 10
    });
  });

  it('exige DB_USER', () => {
    expect(() => new Configuracao({ ...envValido, DB_USER: '' }).banco()).toThrow(
      ConfiguracaoError
    );
  });

  it('recusa porta inválida', () => {
    expect(() => new Configuracao({ ...envValido, DB_PORT: 'abc' }).banco()).toThrow(/DB_PORT/);
  });

  it('recusa nome de banco que permitiria injetar SQL', () => {
    expect(() => new Configuracao({ ...envValido, DB_NAME: 'x; DROP DATABASE y' }).banco()).toThrow(
      /DB_NAME/
    );
  });

  it('usa root como admin padrão', () => {
    expect(new Configuracao(envValido).adminBanco()).toEqual({ user: 'root', password: '' });
  });

  it('lê a configuração da API de notificações, tirando a barra do final', () => {
    const env = { NOTIFICACOES_URL: 'http://127.0.0.1:4000/', NOTIFICACOES_CHAVE: 'abc' };
    expect(new Configuracao(env).notificacoes()).toEqual({
      url: 'http://127.0.0.1:4000',
      chave: 'abc',
      tempoLimiteMs: 5000
    });
  });

  it('notificações: exige a chave e recusa URL sem http', () => {
    expect(() => new Configuracao({}).notificacoes()).toThrow(/NOTIFICACOES_CHAVE/);
    expect(() =>
      new Configuracao({ NOTIFICACOES_URL: 'ftp://x', NOTIFICACOES_CHAVE: 'abc' }).notificacoes()
    ).toThrow(/http/);
  });
});
