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
});
