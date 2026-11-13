import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Migrator } from '../../../src/main/database/Migrator';

describe('Migrator.listarArquivosSql', () => {
  it('lista só .sql, em ordem numérica pelo prefixo', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'migrations-'));
    for (const nome of ['010_c.sql', '002_b.sql', '001_a.sql', 'README.md']) {
      await writeFile(join(pasta, nome), '');
    }
    expect(await Migrator.listarArquivosSql(pasta)).toEqual([
      '001_a.sql',
      '002_b.sql',
      '010_c.sql'
    ]);
  });

  it('as migrations e seeds reais do projeto existem', async () => {
    const base = join(__dirname, '../../../src/main/database');
    expect(await Migrator.listarArquivosSql(join(base, 'migrations'))).toContain(
      '001_criar_tabelas.sql'
    );
    expect(await Migrator.listarArquivosSql(join(base, 'seeds'))).toContain(
      '001_dados_exemplo.sql'
    );
  });
});
