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

/**
 * '11987654321' → '(11) 98765-4321' e '1133334444' → '(11) 3333-4444'.
 * Com menos dígitos formata o que houver (serve de máscara enquanto a pessoa digita).
 */
export function formatarTelefone(telefone: string): string {
  const d = telefone.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  const ddd = `(${d.slice(0, 2)}) `;
  const numero = d.slice(2);
  const corte = numero.length === 9 ? 5 : 4; // celular tem 9 dígitos depois do DDD
  return numero.length > corte
    ? `${ddd}${numero.slice(0, corte)}-${numero.slice(corte)}`
    : ddd + numero;
}

/** '01310100' → '01310-100'. Com menos dígitos formata o que houver (máscara). */
export function formatarCep(cep: string): string {
  const d = cep.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** 3 → '3 itens', 1 → '1 item'. */
export function pluralizar(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}
