import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PoliticaOrigem } from '../../../src/main/security/PoliticaOrigem';

const INDEX = join(process.cwd(), 'out', 'renderer', 'index.html');
const URL_INDEX = pathToFileURL(INDEX).href;

describe('PoliticaOrigem — desenvolvimento', () => {
  const politica = new PoliticaOrigem('http://localhost:5173/', INDEX);

  it('aceita páginas do servidor do Vite', () => {
    expect(politica.origemConfiavel('http://localhost:5173/')).toBe(true);
    expect(politica.origemConfiavel('http://localhost:5173/pagina?x=1#topo')).toBe(true);
  });

  it('recusa porta, host ou protocolo diferentes', () => {
    expect(politica.origemConfiavel('http://localhost:51730/')).toBe(false);
    expect(politica.origemConfiavel('http://localhost:5173.evil.com/')).toBe(false);
    expect(politica.origemConfiavel('https://localhost:5173/')).toBe(false);
    expect(politica.origemConfiavel('http://127.0.0.1:5173/')).toBe(false);
  });

  it('recusa URLs inválidas ou vazias', () => {
    expect(politica.origemConfiavel('')).toBe(false);
    expect(politica.origemConfiavel('não é url')).toBe(false);
  });
});

describe('PoliticaOrigem — produção', () => {
  const politica = new PoliticaOrigem(undefined, INDEX);

  it('aceita só o index.html empacotado (com ou sem #hash/?query)', () => {
    expect(politica.origemConfiavel(URL_INDEX)).toBe(true);
    expect(politica.origemConfiavel(`${URL_INDEX}#/clientes`)).toBe(true);
    expect(politica.origemConfiavel(`${URL_INDEX}?aba=1`)).toBe(true);
  });

  it('recusa outros arquivos locais e sites', () => {
    expect(politica.origemConfiavel(pathToFileURL(join(process.cwd(), 'outro.html')).href)).toBe(false);
    expect(politica.origemConfiavel('https://exemplo.com/')).toBe(false);
    expect(politica.origemConfiavel('http://localhost:5173/')).toBe(false);
  });
});

describe('PoliticaOrigem — links externos', () => {
  const politica = new PoliticaOrigem(undefined, INDEX, ['openstreetmap.org']);

  it('abre só HTTPS de domínios da lista (e subdomínios)', () => {
    expect(politica.podeAbrirExterno('https://openstreetmap.org/rota')).toBe(true);
    expect(politica.podeAbrirExterno('https://www.openstreetmap.org/rota')).toBe(true);
  });

  it('recusa HTTP, outros domínios, domínios parecidos e protocolos perigosos', () => {
    expect(politica.podeAbrirExterno('http://www.openstreetmap.org/')).toBe(false);
    expect(politica.podeAbrirExterno('https://evil.com/')).toBe(false);
    expect(politica.podeAbrirExterno('https://openstreetmap.org.evil.com/')).toBe(false);
    expect(politica.podeAbrirExterno('https://fakeopenstreetmap.org/')).toBe(false);
    expect(politica.podeAbrirExterno('https://user:senha@openstreetmap.org/')).toBe(false);
    expect(politica.podeAbrirExterno('file:///C:/Windows/System32/cmd.exe')).toBe(false);
    expect(politica.podeAbrirExterno('javascript:alert(1)')).toBe(false);
  });
});
