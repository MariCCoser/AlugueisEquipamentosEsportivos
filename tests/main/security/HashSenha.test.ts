import { describe, expect, it } from 'vitest';
import { HashSenha } from '../../../src/main/security/HashSenha';

// Custo 4 (o mínimo do bcrypt) só para os testes rodarem rápido
const hashSenha = new HashSenha(4);

describe('HashSenha', () => {
  it('gera um hash bcrypt que não contém a senha', async () => {
    const hash = await hashSenha.gerar('Segredo@123');
    expect(hash).toMatch(/^\$2[aby]\$04\$/);
    expect(hash).toHaveLength(60); // cabe na coluna senha_hash CHAR(60)
    expect(hash).not.toContain('Segredo@123');
  });

  it('a mesma senha gera hashes diferentes (salt aleatório)', async () => {
    expect(await hashSenha.gerar('Segredo@123')).not.toBe(await hashSenha.gerar('Segredo@123'));
  });

  it('confere a senha certa e recusa a errada', async () => {
    const hash = await hashSenha.gerar('Segredo@123');
    expect(await hashSenha.conferir('Segredo@123', hash)).toBe(true);
    expect(await hashSenha.conferir('segredo@123', hash)).toBe(false);
  });

  it('confere os hashes do seed (custo 10)', async () => {
    const admin = '$2b$10$e5bYUnrTn8FmZb108SQP9.RTSZT87D3PZBV4afM/XTHvGk2SicSS6';
    expect(await new HashSenha().conferir('Admin@2026', admin)).toBe(true);
  });

  it('sem hash (usuário não existe) devolve false sem lançar erro', async () => {
    expect(await hashSenha.conferir('qualquer', null)).toBe(false);
    expect(await hashSenha.conferir('qualquer', undefined)).toBe(false);
  });
});
