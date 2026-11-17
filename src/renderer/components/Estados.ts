import { botao, el } from '../nucleo/dom';

/**
 * Os três estados que toda tela precisa mostrar além dos dados:
 * carregando, vazio e erro.
 */

export function carregando(texto = 'Carregando...'): HTMLElement {
  return el('div', { classe: 'estado', atributos: { role: 'status', 'aria-live': 'polite' } }, [
    el('div', { classe: 'giro', atributos: { 'aria-hidden': 'true' } }),
    el('p', { texto })
  ]);
}

export function estadoVazio(texto: string, acao?: HTMLElement): HTMLElement {
  return el('div', { classe: 'estado' }, [el('p', { texto }), acao]);
}

export function estadoErro(mensagem: string, aoTentarDeNovo?: () => void): HTMLElement {
  return el('div', { classe: 'estado estado--erro', atributos: { role: 'alert' } }, [
    el('p', { texto: `✖ ${mensagem}` }),
    aoTentarDeNovo ? botao('Tentar de novo', () => aoTentarDeNovo()) : null
  ]);
}
