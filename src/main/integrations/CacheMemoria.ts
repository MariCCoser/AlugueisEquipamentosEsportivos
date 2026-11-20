interface Item<T> {
  valor: T;
  venceEm: number;
}

/**
 * Cache simples na memória do Main, com validade e limite de itens.
 *
 * Evita consultar a API de novo para a mesma coisa (mesmo CEP, mesma cidade, mesmo
 * endereço): a resposta fica mais rápida, o app depende menos da internet e respeita
 * os limites de uso das APIs gratuitas. Some quando o app fecha.
 */
export class CacheMemoria<T> {
  private readonly itens = new Map<string, Item<T>>();

  constructor(
    private readonly validadeMs: number,
    private readonly maximoItens = 200,
    private readonly agora: () => number = Date.now
  ) {}

  obter(chave: string): T | undefined {
    const item = this.itens.get(chave);
    if (!item) return undefined;
    if (item.venceEm <= this.agora()) {
      this.itens.delete(chave);
      return undefined;
    }
    return item.valor;
  }

  guardar(chave: string, valor: T): void {
    this.itens.delete(chave); // reinserir coloca no fim (mais recente)
    if (this.itens.size >= this.maximoItens) {
      const maisAntigo = this.itens.keys().next().value;
      if (maisAntigo !== undefined) this.itens.delete(maisAntigo);
    }
    this.itens.set(chave, { valor, venceEm: this.agora() + this.validadeMs });
  }

  /** Devolve do cache ou executa `buscar` e guarda o resultado (erros não são guardados). */
  async obterOuBuscar(chave: string, buscar: () => Promise<T>): Promise<T> {
    const guardado = this.obter(chave);
    if (guardado !== undefined) return guardado;
    const valor = await buscar();
    this.guardar(chave, valor);
    return valor;
  }

  get tamanho(): number {
    return this.itens.size;
  }
}
