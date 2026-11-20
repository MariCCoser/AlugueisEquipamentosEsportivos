import { el } from '../nucleo/dom';

/**
 * Indicador "1 Cliente › 2 Equipamentos › 3 Revisão › 4 Pronto" dos assistentes.
 * O passo atual leva `aria-current="step"`; os anteriores aparecem como concluídos
 * (com texto escondido para leitores de tela, não só a cor).
 */
export function passos(rotulos: readonly string[], atual: number): HTMLElement {
  return el(
    'ol',
    { classe: 'passos', atributos: { 'aria-label': 'Etapas' } },
    rotulos.map((rotulo, i) => {
      const estado = i < atual ? 'feito' : i === atual ? 'atual' : 'futuro';
      return el(
        'li',
        {
          classe: `passos__passo passos__passo--${estado}`,
          atributos: { 'aria-current': i === atual ? 'step' : undefined }
        },
        [
          el('span', {
            classe: 'passos__numero',
            texto: i < atual ? '✓' : String(i + 1),
            atributos: { 'aria-hidden': 'true' }
          }),
          el('span', { texto: rotulo }),
          i < atual ? el('span', { classe: 'sr-only', texto: ' (concluído)' }) : null
        ]
      );
    })
  );
}
