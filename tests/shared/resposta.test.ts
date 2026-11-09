import { describe, expect, it } from 'vitest';
import { falha, sucesso } from '@shared/dto/resposta';
import { IPC } from '@shared/ipc-channels';

describe('Resposta', () => {
  it('sucesso embrulha os dados', () => {
    expect(sucesso(42)).toEqual({ ok: true, dados: 42 });
  });

  it('falha não inclui campos quando não informados', () => {
    expect(falha('INTERNO', 'x')).toEqual({
      ok: false,
      erro: { codigo: 'INTERNO', mensagem: 'x' }
    });
  });

  it('falha inclui erros por campo', () => {
    const r = falha('VALIDACAO', 'Dados inválidos', { cpf: 'CPF inválido' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.campos).toEqual({ cpf: 'CPF inválido' });
  });
});

describe('IPC', () => {
  it('todos os canais seguem o padrão dominio:acao', () => {
    const canais = Object.values(IPC).flatMap((dominio) => Object.values(dominio));
    for (const canal of canais) expect(canal).toMatch(/^[a-z]+:[a-zA-Z]+$/);
  });
});
