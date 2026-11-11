import { pathToFileURL } from 'node:url';

/**
 * Decide quais endereços são "do próprio app" e quais links externos podem ser abertos.
 *
 * - Em desenvolvimento: só a MESMA origem do servidor do Vite (protocolo + host + porta).
 *   Comparar a origem (e não `startsWith`) evita aceitar, por exemplo,
 *   `http://localhost:51730` quando o servidor é `http://localhost:5173`.
 * - Em produção: só o arquivo `index.html` empacotado (ignorando #hash e ?query).
 *
 * Não depende do Electron, por isso pode ser testada com Vitest.
 */
export class PoliticaOrigem {
  private readonly origemDev: string | null;
  private readonly arquivoIndex: string;

  constructor(
    devServerUrl: string | undefined,
    caminhoIndex: string,
    private readonly dominiosExternos: readonly string[] = []
  ) {
    this.origemDev = devServerUrl ? PoliticaOrigem.origemDe(devServerUrl) : null;
    this.arquivoIndex = pathToFileURL(caminhoIndex).href;
  }

  /** true se a URL é uma página do próprio app (usado no IPC e na navegação). */
  origemConfiavel(url: string): boolean {
    const alvo = PoliticaOrigem.analisar(url);
    if (!alvo) return false;

    if (this.origemDev) return alvo.origin === this.origemDev;

    if (alvo.protocol !== 'file:') return false;
    alvo.hash = '';
    alvo.search = '';
    return alvo.href === this.arquivoIndex;
  }

  /**
   * true se o link pode ser aberto no navegador do sistema.
   * Só HTTPS e só domínios da lista (ex.: 'www.google.com' para o mapa da rota).
   */
  podeAbrirExterno(url: string): boolean {
    const alvo = PoliticaOrigem.analisar(url);
    if (!alvo || alvo.protocol !== 'https:' || alvo.username || alvo.password) return false;
    return this.dominiosExternos.some(
      (dominio) => alvo.hostname === dominio || alvo.hostname.endsWith(`.${dominio}`)
    );
  }

  private static origemDe(url: string): string | null {
    return PoliticaOrigem.analisar(url)?.origin ?? null;
  }

  private static analisar(url: string): URL | null {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  }
}
