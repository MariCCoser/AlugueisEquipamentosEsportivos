import { el, novoId } from '../nucleo/dom';

export interface DefinicaoAba<Id extends string> {
  id: Id;
  rotulo: string;
}

/**
 * Abas acessíveis (padrão WAI-ARIA "tabs"): setas ← → trocam de aba,
 * Home/End vão para a primeira/última. Usado em Fornecedores e Devoluções.
 */
export class Abas<Id extends string> {
  readonly elemento: HTMLElement;
  /** Área onde a tela desenha o conteúdo da aba ativa. */
  readonly painel: HTMLElement;
  private readonly botoes: HTMLButtonElement[] = [];

  constructor(
    private readonly abas: readonly DefinicaoAba<Id>[],
    private ativa: Id,
    private readonly aoTrocar: (id: Id) => void,
    rotuloGrupo: string
  ) {
    const idPainel = novoId('painel-aba');
    const lista = el('div', {
      classe: 'abas',
      atributos: { role: 'tablist', 'aria-label': rotuloGrupo }
    });

    for (const aba of abas) {
      const botaoAba = el('button', {
        classe: 'abas__aba',
        texto: aba.rotulo,
        atributos: { type: 'button', role: 'tab', id: novoId('aba'), 'aria-controls': idPainel },
        aoClicar: () => this.selecionar(aba.id)
      });
      botaoAba.addEventListener('keydown', (evento) => this.aoTeclar(evento));
      this.botoes.push(botaoAba);
      lista.append(botaoAba);
    }

    this.painel = el('div', { atributos: { role: 'tabpanel', id: idPainel } });
    this.elemento = el('div', {}, [lista, this.painel]);
    this.atualizarAtributos();
  }

  get abaAtiva(): Id {
    return this.ativa;
  }

  selecionar(id: Id): void {
    if (id === this.ativa) return;
    this.ativa = id;
    this.atualizarAtributos();
    this.aoTrocar(id);
  }

  private atualizarAtributos(): void {
    this.abas.forEach((aba, i) => {
      const selecionada = aba.id === this.ativa;
      const botaoAba = this.botoes[i];
      botaoAba.setAttribute('aria-selected', String(selecionada));
      // Só a aba ativa entra no Tab; as outras se alcançam pelas setas.
      botaoAba.tabIndex = selecionada ? 0 : -1;
      if (selecionada) this.painel.setAttribute('aria-labelledby', botaoAba.id);
    });
  }

  private aoTeclar(evento: KeyboardEvent): void {
    const atual = this.abas.findIndex((a) => a.id === this.ativa);
    const ultimo = this.abas.length - 1;
    const destinos: Record<string, number> = {
      ArrowRight: atual === ultimo ? 0 : atual + 1,
      ArrowLeft: atual === 0 ? ultimo : atual - 1,
      Home: 0,
      End: ultimo
    };
    const destino = destinos[evento.key];
    if (destino === undefined) return;
    evento.preventDefault();
    this.selecionar(this.abas[destino].id);
    this.botoes[destino].focus();
  }
}
