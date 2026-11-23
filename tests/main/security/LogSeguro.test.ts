import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogSeguro } from '../../../src/main/security/LogSeguro';

/** Erro como o mysql2 lança (com o texto do MySQL e campos extras). */
function erroMysql(mensagem: string, code: string) {
  return Object.assign(new Error(mensagem), {
    code,
    sql: "INSERT INTO clientes (cpf) VALUES ('52998224725')",
    values: ['52998224725']
  });
}

describe('LogSeguro.mascarar', () => {
  it('esconde CPF com e sem pontuação', () => {
    expect(LogSeguro.mascarar("Duplicate entry '52998224725' for key 'uk_clientes_cpf'")).toBe(
      "Duplicate entry '[número]' for key 'uk_clientes_cpf'"
    );
    expect(LogSeguro.mascarar('cpf 529.982.247-25')).toBe('cpf [número]');
  });

  it('esconde telefone e e-mail', () => {
    expect(LogSeguro.mascarar('ligar (11) 98765-4321 ou 1133334444')).toBe(
      'ligar [número] ou [número]'
    );
    expect(LogSeguro.mascarar("Duplicate entry 'ana.souza@email.com' for key")).toBe(
      "Duplicate entry '[e-mail]' for key"
    );
  });

  it('esconde o texto de busca de URLs (pode ter o endereço do cliente)', () => {
    expect(
      LogSeguro.mascarar('https://site.com/search?q=Avenida%20Paulista%201000 bloqueado')
    ).toBe('https://site.com/search?[...] bloqueado');
  });

  it('mantém ids, datas e códigos de erro legíveis', () => {
    const texto = 'Reserva #12 em 2026-11-20, erro 1062, porta 3306';
    expect(LogSeguro.mascarar(texto)).toBe(texto);
  });
});

describe('LogSeguro.erro', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loga só nome, código e mensagem mascarada (sem sql nem values do mysql2)', () => {
    const espiao = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    LogSeguro.erro(
      '[IPC clientes:criar]',
      erroMysql("Duplicate entry '52998224725' for key 'uk_clientes_cpf'", 'ER_DUP_ENTRY')
    );
    expect(espiao).toHaveBeenCalledWith(
      '[IPC clientes:criar]',
      "Error ER_DUP_ENTRY: Duplicate entry '[número]' for key 'uk_clientes_cpf'"
    );
    expect(JSON.stringify(espiao.mock.calls)).not.toContain('52998224725');
  });
});
