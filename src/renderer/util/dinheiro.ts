/**
 * Lê um valor em reais digitado num campo ("45,5", "45.50") com as mesmas regras do
 * Main (Campos.dinheiro): número positivo e no máximo 2 casas decimais.
 * Devolve o valor ou a mensagem de erro para mostrar embaixo do campo.
 */
export function lerDinheiro(
  texto: string,
  { permitirZero = false }: { permitirZero?: boolean } = {}
): { valor: number; erro?: undefined } | { valor?: undefined; erro: string } {
  const limpo = texto.trim().replace(',', '.');
  const minimo = permitirZero ? 'igual ou maior que zero' : 'maior que zero';
  if (!limpo) return permitirZero ? { valor: 0 } : { erro: `Informe um valor ${minimo}.` };
  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor < 0 || (!permitirZero && valor === 0)) {
    return { erro: `Informe um valor ${minimo}.` };
  }
  if (Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-6) {
    return { erro: 'Use no máximo 2 casas decimais.' };
  }
  return { valor };
}
