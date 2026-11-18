import { el } from '../nucleo/dom';
import { itemMenuAtivo } from '../util/rotas';

export interface ItemMenu {
  caminho: string;
  rotulo: string;
}

/**
 * Estrutura fixa da janela: menu lateral à esquerda e área de conteúdo à direita.
 * O Roteador desenha as telas dentro de `conteudo`.
 */
export class Layout {
  readonly elemento: HTMLElement;
  readonly conteudo: HTMLElement;
  private readonly links: { caminho: string; link: HTMLAnchorElement }[] = [];
  /** Quem está logado + botões "Trocar senha" e "Sair" (preenchido por `mostrarUsuario`). */
  private readonly areaUsuario = el('div', {
    classe: 'menu-lateral__usuario',
    atributos: { hidden: true }
  });

  constructor(itens: readonly ItemMenu[], nomeApp: string, rodape: string) {
    const lista = el('ul', { classe: 'menu-lateral__lista' });
    for (const item of itens) {
      const link = el('a', {
        classe: 'menu-lateral__link',
        texto: item.rotulo,
        atributos: { href: '#' + item.caminho }
      });
      this.links.push({ caminho: item.caminho, link });
      lista.append(el('li', {}, [link]));
    }

    const menu = el(
      'nav',
      { classe: 'menu-lateral', atributos: { 'aria-label': 'Menu principal' } },
      [
        el('div', { classe: 'menu-lateral__marca', texto: nomeApp }),
        lista,
        this.areaUsuario,
        el('div', { classe: 'menu-lateral__rodape', texto: rodape })
      ]
    );

    this.conteudo = el('main', { classe: 'conteudo', atributos: { id: 'conteudo', tabindex: -1 } });
    // Primeiro item do Tab: quem usa teclado não precisa passar pelos 10 itens do menu.
    // Não usa href="#conteudo" porque o roteador trataria isso como uma rota.
    const pular = el('a', {
      classe: 'pular-para-conteudo',
      texto: 'Pular para o conteúdo',
      atributos: { href: '#conteudo' },
      aoClicar: (evento) => {
        evento.preventDefault();
        this.conteudo.focus();
      }
    });
    this.elemento = el('div', { classe: 'layout' }, [pular, menu, this.conteudo]);
  }

  /** Destaca no menu o item da tela atual (aria-current lido por leitores de tela). */
  marcarAtivo(caminhoAtual: string): void {
    for (const { caminho, link } of this.links) {
      if (itemMenuAtivo(caminho, caminhoAtual)) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  /** Mostra quem está logado e as ações da conta no pé do menu. */
  mostrarUsuario(nome: string, perfil: string, acoes: HTMLElement[]): void {
    this.areaUsuario.replaceChildren(
      el('p', { classe: 'menu-lateral__nome' }, [
        el('span', { classe: 'sr-only', texto: 'Conectado como ' }),
        nome
      ]),
      el('p', { classe: 'menu-lateral__perfil', texto: perfil }),
      el('div', { classe: 'menu-lateral__acoes' }, acoes)
    );
    this.areaUsuario.hidden = false;
  }

  atualizarRodape(texto: string): void {
    const rodape = this.elemento.querySelector('.menu-lateral__rodape');
    if (rodape) rodape.textContent = texto;
  }
}
