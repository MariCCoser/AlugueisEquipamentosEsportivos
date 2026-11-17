import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalArquivoEnv, type InfoApp } from '../../../src/main/config/LocalArquivoEnv';

const pastaDados = join('C:', 'Users', 'loja', 'AppData', 'Roaming', 'Locadora Esportiva');
const pastaPrograma = join('C:', 'Programas', 'Locadora Esportiva');

const info = (empacotado: boolean): InfoApp => ({
  empacotado,
  pastaDados,
  executavel: join(pastaPrograma, 'Locadora Esportiva.exe'),
  pastaAtual: join('C:', 'projeto')
});

describe('LocalArquivoEnv', () => {
  it('em desenvolvimento usa o .env da pasta atual (raiz do projeto)', () => {
    const local = new LocalArquivoEnv(info(false), () => false);
    expect(local.candidatos()).toEqual([resolve(join('C:', 'projeto'), '.env')]);
    expect(local.caminho()).toBe(resolve(join('C:', 'projeto'), '.env'));
  });

  it('instalado: prefere a pasta de dados do usuário', () => {
    const local = new LocalArquivoEnv(info(true), () => true);
    expect(local.caminho()).toBe(join(pastaDados, '.env'));
  });

  it('instalado: usa o .env ao lado do .exe se não houver na pasta de dados', () => {
    const aoLadoDoExe = join(pastaPrograma, '.env');
    const local = new LocalArquivoEnv(info(true), (caminho) => caminho === aoLadoDoExe);
    expect(local.caminho()).toBe(aoLadoDoExe);
  });

  it('instalado sem .env: aponta para a pasta de dados (onde a pessoa deve criar)', () => {
    const local = new LocalArquivoEnv(info(true), () => false);
    expect(local.caminho()).toBe(join(pastaDados, '.env'));
  });

  it('instalado nunca usa a pasta atual (aberto pelo menu Iniciar ela é System32)', () => {
    const local = new LocalArquivoEnv(info(true), () => false);
    expect(local.candidatos()).not.toContain(resolve(join('C:', 'projeto'), '.env'));
  });
});
