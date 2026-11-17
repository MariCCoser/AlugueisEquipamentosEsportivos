/**
 * Ajudante para montar elementos sem usar innerHTML.
 *
 * Por que: a CSP e a proteção contra XSS proíbem colocar texto do usuário como HTML.
 * Aqui todo texto vira um nó de texto (textContent), então um nome como
 * "<script>alert(1)</script>" aparece na tela como texto, sem ser executado.
 */
export type Filho = Node | string | number | null | undefined | false;

export interface OpcoesElemento {
  classe?: string;
  texto?: string;
  /** Atributos HTML (id, type, aria-*, role...). Valores sempre tratados como texto. */
  atributos?: Record<string, string | number | boolean | undefined>;
  aoClicar?: (evento: MouseEvent) => void;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opcoes: OpcoesElemento = {},
  filhos: Filho[] = []
): HTMLElementTagNameMap[K] {
  const elemento = document.createElement(tag);
  if (opcoes.classe) elemento.className = opcoes.classe;
  if (opcoes.texto !== undefined) elemento.textContent = opcoes.texto;

  for (const [nome, valor] of Object.entries(opcoes.atributos ?? {})) {
    if (valor === undefined || valor === false) continue;
    elemento.setAttribute(nome, valor === true ? '' : String(valor));
  }

  // O cast para HTMLElement deixa o TypeScript escolher a assinatura de 'click' (MouseEvent).
  if (opcoes.aoClicar) (elemento as HTMLElement).addEventListener('click', opcoes.aoClicar);
  adicionarFilhos(elemento, filhos);
  return elemento;
}

export function adicionarFilhos(pai: Element, filhos: Filho[]): void {
  for (const filho of filhos) {
    if (filho === null || filho === undefined || filho === false) continue;
    pai.append(typeof filho === 'number' ? String(filho) : filho);
  }
}

/** Botão já com as classes do tema. `type="button"` evita enviar formulários sem querer. */
export function botao(
  texto: string,
  aoClicar: (evento: MouseEvent) => void,
  variante: 'padrao' | 'primario' | 'perigo' = 'padrao',
  extras: OpcoesElemento['atributos'] = {}
): HTMLButtonElement {
  const classe = variante === 'padrao' ? 'botao' : `botao botao--${variante}`;
  return el('button', { classe, texto, aoClicar, atributos: { type: 'button', ...extras } });
}

/** Gera ids únicos para ligar label/campo/mensagem de erro (acessibilidade). */
let contadorIds = 0;
export function novoId(prefixo: string): string {
  contadorIds += 1;
  return `${prefixo}-${contadorIds}`;
}
