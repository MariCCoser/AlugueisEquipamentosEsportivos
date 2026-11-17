import { cabecalhoTela } from '../components/CabecalhoTela';
import { estadoVazio } from '../components/Estados';
import type { Tela } from '../nucleo/Tela';

/** Lugar reservado para as telas que ainda vão ser construídas. */
export class EmConstrucaoTela implements Tela {
  constructor(readonly titulo: string) {}

  montar(alvo: HTMLElement): void {
    alvo.append(cabecalhoTela(this.titulo), estadoVazio('Esta tela ainda está em construção.'));
  }
}
