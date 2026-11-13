import type {
  DestinatarioDTO,
  PedidoAvisoMultaDTO,
  PedidoLembreteDTO
} from '../../src/shared/dto/notificacao.dto';

/** Erro de dado inválido no corpo da requisição. Vira resposta 400. */
export class PedidoInvalidoError extends Error {}

type Objeto = Record<string, unknown>;

function objeto(valor: unknown, nome: string): Objeto {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new PedidoInvalidoError(`"${nome}" precisa ser um objeto.`);
  }
  return valor as Objeto;
}

function texto(valor: unknown, nome: string, tamanhoMaximo = 150): string {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new PedidoInvalidoError(`"${nome}" é obrigatório.`);
  }
  if (valor.length > tamanhoMaximo) {
    throw new PedidoInvalidoError(`"${nome}" pode ter no máximo ${tamanhoMaximo} caracteres.`);
  }
  return valor.trim();
}

function inteiroPositivo(valor: unknown, nome: string): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
    throw new PedidoInvalidoError(`"${nome}" precisa ser um número inteiro maior que zero.`);
  }
  return valor;
}

function destinatario(valor: unknown): DestinatarioDTO {
  const cliente = objeto(valor, 'cliente');
  const telefone = texto(cliente['telefone'], 'cliente.telefone', 20);
  if (!/^\d{10,13}$/.test(telefone)) {
    throw new PedidoInvalidoError('"cliente.telefone" deve ter só dígitos, com DDD.');
  }

  const resultado: DestinatarioDTO = { nome: texto(cliente['nome'], 'cliente.nome'), telefone };
  if (cliente['email'] !== undefined && cliente['email'] !== null && cliente['email'] !== '') {
    const email = texto(cliente['email'], 'cliente.email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new PedidoInvalidoError('"cliente.email" não é um e-mail válido.');
    }
    resultado.email = email;
  }
  return resultado;
}

export function validarPedidoLembrete(corpo: unknown): PedidoLembreteDTO {
  const pedido = objeto(corpo, 'corpo');

  const data = texto(pedido['dataDevolucaoPrevista'], 'dataDevolucaoPrevista', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new PedidoInvalidoError('"dataDevolucaoPrevista" deve estar no formato AAAA-MM-DD.');
  }

  const equipamentos = pedido['equipamentos'];
  if (!Array.isArray(equipamentos) || equipamentos.length === 0 || equipamentos.length > 50) {
    throw new PedidoInvalidoError('"equipamentos" precisa ter de 1 a 50 nomes.');
  }

  return {
    cliente: destinatario(pedido['cliente']),
    reservaId: inteiroPositivo(pedido['reservaId'], 'reservaId'),
    dataDevolucaoPrevista: data,
    equipamentos: equipamentos.map((nome, i) => texto(nome, `equipamentos[${i}]`, 120))
  };
}

export function validarPedidoAvisoMulta(corpo: unknown): PedidoAvisoMultaDTO {
  const pedido = objeto(corpo, 'corpo');

  const valor = pedido['valor'];
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) {
    throw new PedidoInvalidoError('"valor" precisa ser um número maior ou igual a zero.');
  }

  return {
    cliente: destinatario(pedido['cliente']),
    multaId: inteiroPositivo(pedido['multaId'], 'multaId'),
    reservaId: inteiroPositivo(pedido['reservaId'], 'reservaId'),
    diasAtraso: inteiroPositivo(pedido['diasAtraso'], 'diasAtraso'),
    valor
  };
}
