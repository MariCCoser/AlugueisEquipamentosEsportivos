import { somenteDigitos } from './cnpj';

/**
 * Validação e formatação de CPF, para a tela avisar na hora (formulário de
 * clientes) e para o Main poder usar a mesma regra no schema zod.
 * Mesmo esquema do cnpj.ts: dois dígitos verificadores calculados com módulo 11.
 */

function digitoVerificador(base: string, pesoInicial: number): number {
  let soma = 0;
  for (let i = 0; i < pesoInicial - 1; i++) soma += Number(base[i]) * (pesoInicial - i);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Aceita com ou sem pontuação ("529.982.247-25" ou "52998224725"). */
export function cpfValido(cpf: string): boolean {
  const d = somenteDigitos(cpf);
  // 11 dígitos e não todos iguais (111.111.111-11 passaria no cálculo)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  return digitoVerificador(d, 10) === Number(d[9]) && digitoVerificador(d, 11) === Number(d[10]);
}

/**
 * '52998224725' → '529.982.247-25'.
 * Com menos dígitos formata o que houver (serve de máscara enquanto a pessoa digita).
 */
export function formatarCpf(cpf: string): string {
  const d = somenteDigitos(cpf).slice(0, 11);
  const partes = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)];
  const separadores = ['', '.', '.', '-'];
  return partes.map((parte, i) => (parte ? separadores[i] + parte : '')).join('');
}
