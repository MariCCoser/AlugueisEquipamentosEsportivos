/**
 * Lógica pura do roteador (sem DOM), para poder ser testada no Vitest.
 *
 * Usamos endereços com hash (#/clientes) e não o History API: no app instalado
 * a página é aberta como arquivo local (file://) e caminhos "de verdade"
 * quebrariam ao recarregar.
 */
export type Parametros = Record<string, string>;

export interface DefinicaoRota<T> {
  /** Padrão do caminho. Ex.: '/', '/clientes', '/clientes/:id'. */
  caminho: string;
  criar: (parametros: Parametros, consulta: URLSearchParams) => T;
}

export interface RotaEncontrada<T> {
  rota: DefinicaoRota<T>;
  parametros: Parametros;
  consulta: URLSearchParams;
}

/** '#/clientes/?aba=x' → { caminho: '/clientes', consulta: 'aba=x' } */
export function separarHash(hash: string): { caminho: string; consulta: URLSearchParams } {
  const semCerquilha = hash.replace(/^#/, '');
  const [parteCaminho = '', parteConsulta = ''] = semCerquilha.split('?', 2);
  return {
    caminho: normalizarCaminho(parteCaminho),
    consulta: new URLSearchParams(parteConsulta)
  };
}

export function normalizarCaminho(caminho: string): string {
  const partes = caminho.split('/').filter((p) => p.length > 0);
  return '/' + partes.join('/');
}

/** Compara um padrão ('/clientes/:id') com um caminho ('/clientes/7'). */
export function casarCaminho(padrao: string, caminho: string): Parametros | null {
  const partesPadrao = normalizarCaminho(padrao).split('/').filter(Boolean);
  const partesCaminho = normalizarCaminho(caminho).split('/').filter(Boolean);
  if (partesPadrao.length !== partesCaminho.length) return null;

  const parametros: Parametros = {};
  for (let i = 0; i < partesPadrao.length; i++) {
    const esperado = partesPadrao[i];
    const recebido = partesCaminho[i];
    if (esperado.startsWith(':')) {
      parametros[esperado.slice(1)] = decodeURIComponent(recebido);
    } else if (esperado !== recebido) {
      return null;
    }
  }
  return parametros;
}

export function encontrarRota<T>(
  rotas: readonly DefinicaoRota<T>[],
  hash: string
): RotaEncontrada<T> | null {
  const { caminho, consulta } = separarHash(hash);
  for (const rota of rotas) {
    const parametros = casarCaminho(rota.caminho, caminho);
    if (parametros) return { rota, parametros, consulta };
  }
  return null;
}

/** Diz se um item do menu deve aparecer como ativo para o caminho atual. */
export function itemMenuAtivo(caminhoItem: string, caminhoAtual: string): boolean {
  const item = normalizarCaminho(caminhoItem);
  const atual = normalizarCaminho(caminhoAtual);
  if (item === '/') return atual === '/';
  return atual === item || atual.startsWith(item + '/');
}
