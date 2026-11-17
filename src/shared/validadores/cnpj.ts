/**
 * Validação e formatação de CNPJ, usadas no Main (schema zod) e na tela
 * (resposta imediata no formulário). Ficam em shared/ para as duas pontas
 * usarem exatamente a mesma regra.
 *
 * Limitação conhecida: a Receita Federal anunciou um CNPJ alfanumérico para
 * empresas novas a partir de 2026. Aqui validamos o formato numérico, que é o
 * de todas as empresas já existentes.
 */

/** Pesos oficiais do cálculo dos dois dígitos verificadores. */
const PESOS_PRIMEIRO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO = [6, ...PESOS_PRIMEIRO];

export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

function digitoVerificador(base: string, pesos: readonly number[]): number {
  const soma = pesos.reduce((total, peso, i) => total + Number(base[i]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Aceita com ou sem pontuação ("11.222.333/0001-81" ou "11222333000181"). */
export function cnpjValido(cnpj: string): boolean {
  const d = somenteDigitos(cnpj);
  // 14 dígitos e não todos iguais (00.000.000/0000-00 passaria no cálculo)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  return (
    digitoVerificador(d, PESOS_PRIMEIRO) === Number(d[12]) &&
    digitoVerificador(d, PESOS_SEGUNDO) === Number(d[13])
  );
}

/**
 * '11222333000181' → '11.222.333/0001-81'.
 * Com menos dígitos formata o que houver (serve de máscara enquanto a pessoa digita).
 */
export function formatarCnpj(cnpj: string): string {
  const d = somenteDigitos(cnpj).slice(0, 14);
  const partes = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)];
  const separadores = ['', '.', '.', '/', '-'];
  return partes.map((parte, i) => (parte ? separadores[i] + parte : '')).join('');
}
