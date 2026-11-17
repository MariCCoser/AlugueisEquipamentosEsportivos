/**
 * Formatação de valores para exibição (padrão brasileiro).
 * Sem DOM, para poder ser testado no Vitest.
 */

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 1234.5 → 'R$ 1.234,50' (valores trafegam em reais pelo IPC). */
export function formatarMoeda(reais: number): string {
  // O Intl usa um espaço especial (não separável) depois do "R$"; \s o troca por espaço comum.
  return moeda.format(reais).replace(/\s/g, ' ');
}

/**
 * '2026-11-17' → '17/11/2026'.
 * Não usa `new Date()` de propósito: uma data sem hora seria lida como UTC
 * e, no fuso do Brasil, poderia aparecer como o dia anterior.
 */
export function formatarData(iso: string): string {
  const correspondencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!correspondencia) return iso;
  const [, ano, mes, dia] = correspondencia;
  return `${dia}/${mes}/${ano}`;
}

/** 3 → '3 itens', 1 → '1 item'. */
export function pluralizar(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}
