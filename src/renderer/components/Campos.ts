import { el, novoId } from '../nucleo/dom';

/**
 * Campos de formulário com label, ajuda e mensagem de erro já ligados
 * para leitores de tela (htmlFor, aria-invalid, aria-describedby).
 */
abstract class CampoBase<E extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
  readonly elemento: HTMLElement;
  protected readonly erro: HTMLElement;
  private readonly idAjuda?: string;

  protected constructor(
    readonly controle: E,
    rotulo: string,
    ajuda?: string,
    classeExtra = ''
  ) {
    controle.id ||= novoId('campo');
    this.erro = el('span', {
      classe: 'campo__erro',
      atributos: { id: `${controle.id}-erro`, hidden: true }
    });

    const elementoAjuda = ajuda
      ? el('span', {
          classe: 'campo__ajuda',
          texto: ajuda,
          atributos: { id: `${controle.id}-ajuda` }
        })
      : null;
    this.idAjuda = elementoAjuda?.id;
    this.atualizarDescricao(false);

    const label = el('label', { texto: rotulo, atributos: { for: controle.id } });
    const partes = classeExtra.includes('checkbox')
      ? [controle, label, elementoAjuda, this.erro]
      : [label, controle, elementoAjuda, this.erro];
    this.elemento = el('div', { classe: `campo ${classeExtra}`.trim() }, partes);
  }

  get nome(): string {
    return this.controle.name;
  }

  /** Mostra (ou limpa, com `undefined`) a mensagem de erro embaixo do campo. */
  definirErro(mensagem?: string): void {
    const temErro = Boolean(mensagem);
    this.erro.textContent = mensagem ?? '';
    this.erro.hidden = !temErro;
    this.controle.setAttribute('aria-invalid', String(temErro));
    this.atualizarDescricao(temErro);
  }

  focar(): void {
    this.controle.focus();
  }

  private atualizarDescricao(temErro: boolean): void {
    const ids = [this.idAjuda, temErro ? this.erro.id : undefined].filter(Boolean).join(' ');
    if (ids) this.controle.setAttribute('aria-describedby', ids);
    else this.controle.removeAttribute('aria-describedby');
  }
}

export interface OpcoesCampoTexto {
  nome: string;
  rotulo: string;
  tipo?: 'text' | 'email' | 'password' | 'number' | 'date' | 'tel';
  valor?: string;
  obrigatorio?: boolean;
  ajuda?: string;
  maximo?: number;
  autocompletar?: string;
}

export class CampoTexto extends CampoBase<HTMLInputElement> {
  constructor(opcoes: OpcoesCampoTexto) {
    super(
      el('input', {
        atributos: {
          name: opcoes.nome,
          type: opcoes.tipo ?? 'text',
          required: opcoes.obrigatorio,
          'aria-required': opcoes.obrigatorio ? 'true' : undefined,
          maxlength: opcoes.maximo,
          autocomplete: opcoes.autocompletar
        }
      }),
      opcoes.rotulo,
      opcoes.ajuda
    );
    this.controle.value = opcoes.valor ?? '';
  }

  get valor(): string {
    return this.controle.value;
  }

  set valor(novo: string) {
    this.controle.value = novo;
  }
}

export interface OpcaoSelect {
  valor: string;
  rotulo: string;
}

export interface OpcoesCampoSelect {
  nome: string;
  rotulo: string;
  opcoes: OpcaoSelect[];
  valor?: string;
  /** Texto da primeira opção vazia (ex.: "Todas"). Sem ele, não há opção vazia. */
  opcaoVazia?: string;
  obrigatorio?: boolean;
  ajuda?: string;
  aoMudar?: (valor: string) => void;
}

export class CampoSelect extends CampoBase<HTMLSelectElement> {
  constructor(opcoes: OpcoesCampoSelect) {
    const select = el('select', {
      atributos: { name: opcoes.nome, required: opcoes.obrigatorio }
    });
    super(select, opcoes.rotulo, opcoes.ajuda);
    this.definirOpcoes(opcoes.opcoes, opcoes.opcaoVazia);
    select.value = opcoes.valor ?? '';
    const aoMudar = opcoes.aoMudar;
    if (aoMudar) select.addEventListener('change', () => aoMudar(select.value));
  }

  get valor(): string {
    return this.controle.value;
  }

  set valor(novo: string) {
    this.controle.value = novo;
  }

  /** Troca as opções (ex.: quando a lista de categorias chega do Main). */
  definirOpcoes(opcoes: OpcaoSelect[], opcaoVazia?: string): void {
    const anterior = this.controle.value;
    this.controle.replaceChildren(
      ...(opcaoVazia !== undefined
        ? [el('option', { texto: opcaoVazia, atributos: { value: '' } })]
        : []),
      ...opcoes.map((o) => el('option', { texto: o.rotulo, atributos: { value: o.valor } }))
    );
    this.controle.value = anterior;
  }
}

export interface OpcoesCampoCheckbox {
  nome: string;
  rotulo: string;
  marcado?: boolean;
  ajuda?: string;
}

export class CampoCheckbox extends CampoBase<HTMLInputElement> {
  constructor(opcoes: OpcoesCampoCheckbox) {
    super(
      el('input', { atributos: { name: opcoes.nome, type: 'checkbox' } }),
      opcoes.rotulo,
      opcoes.ajuda,
      'campo--checkbox'
    );
    this.controle.checked = opcoes.marcado ?? false;
  }

  get marcado(): boolean {
    return this.controle.checked;
  }

  set marcado(novo: boolean) {
    this.controle.checked = novo;
  }
}

/**
 * Mostra os erros de validação que vieram do Main (`erro.campos`) nos campos certos
 * e coloca o foco no primeiro campo com erro. Devolve `true` se algum erro foi exibido.
 */
export function aplicarErros(
  campos: readonly CampoBase<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>[],
  erros: Record<string, string> | undefined
): boolean {
  let primeiro: (typeof campos)[number] | undefined;
  for (const campo of campos) {
    const mensagem = erros?.[campo.nome];
    campo.definirErro(mensagem);
    if (mensagem && !primeiro) primeiro = campo;
  }
  primeiro?.focar();
  return primeiro !== undefined;
}

export type { CampoBase };
