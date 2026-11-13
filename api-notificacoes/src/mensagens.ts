import type { PedidoAvisoMultaDTO, PedidoLembreteDTO } from '../../src/shared/dto/notificacao.dto';

/** Textos que o cliente recebe. Funções puras: recebem os dados e devolvem o texto. */

const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** '2026-11-20' -> '20/11/2026' */
export function formatarData(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** 24 -> 'R$ 24,00' */
export function formatarDinheiro(valor: number): string {
  // O Intl usa um espaço especial (não separável); trocamos por espaço comum.
  return real.format(valor).replace(/\s/g, ' ');
}

/** ['Caiaque', 'Remo', 'Colete'] -> 'Caiaque, Remo e Colete' */
export function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes.join('');
  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}

function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? nomeCompleto;
}

export function textoLembrete(pedido: PedidoLembreteDTO): string {
  return (
    `Olá, ${primeiroNome(pedido.cliente.nome)}! ` +
    `Lembramos que a devolução da reserva nº ${pedido.reservaId} ` +
    `(${juntarNomes(pedido.equipamentos)}) está prevista para ${formatarData(pedido.dataDevolucaoPrevista)}. ` +
    'Devoluções em atraso geram multa. Obrigado!'
  );
}

export function textoAvisoMulta(pedido: PedidoAvisoMultaDTO): string {
  const dias = pedido.diasAtraso === 1 ? '1 dia' : `${pedido.diasAtraso} dias`;
  return (
    `Olá, ${primeiroNome(pedido.cliente.nome)}. ` +
    `A reserva nº ${pedido.reservaId} foi devolvida com ${dias} de atraso ` +
    `e gerou uma multa de ${formatarDinheiro(pedido.valor)}. ` +
    'Em caso de dúvidas, fale com a loja.'
  );
}
