import bcrypt from 'bcryptjs';
import { afterAll, describe, expect, it } from 'vitest';
import { Configuracao } from '../../../src/main/config/Configuracao';
import { Database } from '../../../src/main/database/Database';
import { DiagnosticoBanco, TABELAS } from '../../../src/main/database/DiagnosticoBanco';

/**
 * Testes que precisam do MySQL rodando e do `npm run db:setup` já executado.
 * Só rodam com: DB_TESTE=1 npm test
 */
Configuracao.carregarArquivoEnv();
const habilitado = process.env['DB_TESTE'] === '1';

describe.skipIf(!habilitado)('Database (integração com MySQL)', () => {
  const db = habilitado ? new Database(new Configuracao().banco()) : (null as unknown as Database);

  afterAll(async () => {
    await db?.fechar();
  });

  it('as 10 tabelas existem e têm os dados do seed', async () => {
    const contagens = await new DiagnosticoBanco(db).contarRegistros();
    expect(contagens.map((c) => c.tabela)).toEqual([...TABELAS]);
    for (const { registros } of contagens) expect(registros).toBeGreaterThan(0);
  });

  it('senhas do seed estão em bcrypt e conferem', async () => {
    const [admin] = await db.consultar<{ senha_hash: string }>(
      'SELECT senha_hash FROM usuarios WHERE email = ?',
      ['admin@aluguel.local']
    );
    expect(admin?.senha_hash).toMatch(/^\$2[aby]\$10\$/);
    expect(await bcrypt.compare('Admin@2026', admin!.senha_hash)).toBe(true);
  });

  it('datas voltam como string e DECIMAL como number', async () => {
    const [reserva] = await db.consultar<{ data_retirada: unknown; valor_total: unknown }>(
      'SELECT data_retirada, valor_total FROM reservas WHERE id = ?',
      [1]
    );
    expect(reserva?.data_retirada).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(reserva?.valor_total).toBe(300);
  });

  it('transação faz rollback quando dá erro', async () => {
    const contar = async () =>
      (await db.consultar<{ n: number }>('SELECT COUNT(*) AS n FROM categorias'))[0]!.n;
    const antes = await contar();

    await expect(
      db.transacao(async (tx) => {
        await tx.executar('INSERT INTO categorias (nome) VALUES (?)', ['Categoria Temporária']);
        throw new Error('falha simulada');
      })
    ).rejects.toThrow('falha simulada');

    expect(await contar()).toBe(antes);
  });

  it('transação faz commit quando dá certo', async () => {
    const id = await db.transacao(async (tx) => {
      const { idInserido } = await tx.executar('INSERT INTO categorias (nome) VALUES (?)', [
        'Categoria do Teste'
      ]);
      return idInserido;
    });
    const [categoria] = await db.consultar<{ nome: string }>(
      'SELECT nome FROM categorias WHERE id = ?',
      [id]
    );
    expect(categoria?.nome).toBe('Categoria do Teste');
    await db.executar('DELETE FROM categorias WHERE id = ?', [id]);
  });
});
