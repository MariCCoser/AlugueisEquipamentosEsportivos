import type { IdDTO } from '@shared/dto';
import type {
  AtualizarClienteDTO,
  ClienteDTO,
  CriarClienteDTO,
  FiltroClienteDTO,
  HistoricoClienteDTO
} from '@shared/dto/cliente.dto';
import type { BuscarCepDTO, EnderecoDTO } from '@shared/dto/integracao.dto';
import type { ReservaResumoDTO } from '@shared/dto/reserva.dto';
import type { Paginado } from '@shared/dto/resposta';
import { somenteDigitos } from '@shared/validadores/cnpj';
import { cpfValido } from '@shared/validadores/cpf';
import { ErroSimulado, type Simulacao } from '../apiSimulada';

const mascararCpf = (cpf: string): string => `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;

/**
 * Clientes em memória (só em desenvolvimento), com os mesmos dados do seed e as
 * regras principais do ClienteService: CPF único e não excluir quem tem reservas.
 */
export function simularClientes(): Simulacao {
  let proximoId = 6;
  const agora = '2026-03-10 10:00:00';
  const novo = (dados: CriarClienteDTO, id: number, criado = agora): ClienteDTO => ({
    ...dados,
    id,
    cpfMascarado: mascararCpf(dados.cpf),
    createdAt: criado,
    updatedAt: criado
  });

  let clientes: ClienteDTO[] = [
    novo(
      {
        nome: 'Ana Souza',
        cpf: '52998224725',
        telefone: '11987654321',
        email: 'ana.souza@email.com',
        cep: '01310100',
        rua: 'Avenida Paulista',
        numero: '1000',
        complemento: 'Apto 52',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        uf: 'SP'
      },
      1,
      '2025-11-02 14:20:00'
    ),
    novo(
      {
        nome: 'Bruno Lima',
        cpf: '12345678909',
        telefone: '21998765432',
        email: 'bruno.lima@email.com',
        cep: '22041001',
        rua: 'Avenida Atlântica',
        numero: '250',
        bairro: 'Copacabana',
        cidade: 'Rio de Janeiro',
        uf: 'RJ'
      },
      2
    ),
    novo(
      {
        nome: 'Carla Mendes',
        cpf: '98765432100',
        telefone: '41991234567',
        cep: '80010000',
        rua: 'Rua XV de Novembro',
        numero: '78',
        complemento: 'Sala 3',
        bairro: 'Centro',
        cidade: 'Curitiba',
        uf: 'PR'
      },
      3
    ),
    novo(
      {
        nome: 'Diego Ferreira',
        cpf: '11144477735',
        telefone: '48999887766',
        email: 'diego.f@email.com',
        cep: '88015000',
        rua: 'Rua Felipe Schmidt',
        numero: '15',
        bairro: 'Centro',
        cidade: 'Florianópolis',
        uf: 'SC'
      },
      4
    ),
    novo(
      {
        nome: 'Elisa Rocha',
        cpf: '39053344705',
        telefone: '31988776655',
        email: 'elisa.rocha@email.com',
        cep: '30130000',
        rua: 'Avenida Afonso Pena',
        numero: '1500',
        complemento: 'Bloco B',
        bairro: 'Centro',
        cidade: 'Belo Horizonte',
        uf: 'MG'
      },
      5
    )
  ];

  const reserva = (
    id: number,
    clienteId: number,
    status: ReservaResumoDTO['status'],
    periodo: [string, string],
    valorTotal: number,
    totalPago: number,
    qtdItens: number
  ): ReservaResumoDTO => ({
    id,
    clienteId,
    clienteNome: clientes.find((c) => c.id === clienteId)?.nome ?? '',
    usuarioId: 1,
    dataRetirada: periodo[0],
    dataDevolucaoPrevista: periodo[1],
    status,
    valorTotal,
    valorCaucao: 100,
    caucaoStatus: status === 'ATIVA' ? 'RETIDA' : 'DEVOLVIDA',
    totalPago,
    qtdItens
  });
  const reservas: ReservaResumoDTO[] = [
    reserva(1, 1, 'ATIVA', ['2026-11-10', '2026-11-14'], 225, 225, 1),
    reserva(5, 1, 'DEVOLVIDA', ['2026-09-05', '2026-09-07'], 270, 270, 2),
    reserva(2, 2, 'ATIVA', ['2026-11-15', '2026-11-18'], 360, 100, 1),
    reserva(3, 4, 'ATIVA', ['2026-11-16', '2026-11-20'], 350, 350, 1),
    reserva(4, 4, 'CANCELADA', ['2026-10-01', '2026-10-02'], 40, 0, 1)
  ];

  const obter = (id: number): ClienteDTO => {
    const cliente = clientes.find((c) => c.id === id);
    if (!cliente) {
      throw new ErroSimulado({
        codigo: 'NAO_ENCONTRADO',
        mensagem: `Cliente #${id} não encontrado(a).`
      });
    }
    return cliente;
  };

  const validarCpf = (cpf: string | undefined, idAtual?: number): void => {
    if (cpf === undefined) return;
    if (!cpfValido(cpf)) {
      throw new ErroSimulado({
        codigo: 'VALIDACAO',
        mensagem: 'Dados inválidos. Confira os campos destacados.',
        campos: { cpf: 'CPF inválido.' }
      });
    }
    if (clientes.some((c) => c.cpf === somenteDigitos(cpf) && c.id !== idAtual)) {
      throw new ErroSimulado({
        codigo: 'REGRA_NEGOCIO',
        mensagem: 'Já existe um cliente cadastrado com este CPF.'
      });
    }
  };

  const limpar = (dados: Partial<CriarClienteDTO>): Partial<CriarClienteDTO> => {
    const limpo = { ...dados };
    for (const campo of ['email', 'complemento'] as const) {
      if (campo in dados) limpo[campo] = dados[campo]?.trim() || undefined;
    }
    return limpo;
  };

  return {
    listar: (filtro: FiltroClienteDTO = {}): Paginado<ClienteDTO> => {
      const busca = filtro.busca?.trim().toLowerCase() ?? '';
      const digitos = /^[\d.\-\s]+$/.test(busca) ? somenteDigitos(busca) : '';
      const encontrados = clientes
        .filter((c) =>
          !busca ? true : digitos ? c.cpf.startsWith(digitos) : c.nome.toLowerCase().includes(busca)
        )
        .sort((a, b) => a.nome.localeCompare(b.nome));
      const porPagina = filtro.porPagina ?? 20;
      const pagina = filtro.pagina ?? 1;
      return {
        itens: encontrados.slice((pagina - 1) * porPagina, pagina * porPagina),
        total: encontrados.length,
        pagina,
        porPagina
      };
    },
    buscarPorId: ({ id }: IdDTO) => obter(id),
    criar: (dados: CriarClienteDTO) => {
      validarCpf(dados.cpf);
      const cliente = novo(limpar(dados) as CriarClienteDTO, proximoId++, '2026-11-17 09:00:00');
      clientes.push(cliente);
      return cliente;
    },
    atualizar: ({ id, ...dados }: AtualizarClienteDTO) => {
      const atual = obter(id);
      validarCpf(dados.cpf, id);
      Object.assign(atual, limpar(dados), { cpfMascarado: mascararCpf(dados.cpf ?? atual.cpf) });
      return atual;
    },
    excluir: ({ id }: IdDTO) => {
      obter(id);
      const qtd = reservas.filter((r) => r.clienteId === id).length;
      if (qtd > 0) {
        throw new ErroSimulado({
          codigo: 'REGRA_NEGOCIO',
          mensagem: `Não é possível excluir: o cliente tem ${qtd} reserva(s) no histórico.`
        });
      }
      clientes = clientes.filter((c) => c.id !== id);
    },
    historico: ({ id }: IdDTO): HistoricoClienteDTO => {
      const cliente = obter(id);
      const doCliente = reservas.filter((r) => r.clienteId === id);
      const multasEmAberto =
        id === 1
          ? [
              {
                id: 1,
                reservaId: 5,
                clienteNome: cliente.nome,
                diasAtraso: 2,
                valor: 54,
                quitada: false,
                valorPago: 20
              }
            ]
          : [];
      return {
        cliente,
        reservasAtivas: doCliente.filter((r) => r.status === 'ATIVA'),
        reservasAnteriores: doCliente.filter((r) => r.status !== 'ATIVA'),
        pagamentos: doCliente
          .filter((r) => r.totalPago > 0)
          .map((r) => ({
            id: r.id * 10,
            reservaId: r.id,
            tipo: 'ALUGUEL' as const,
            forma: 'PIX' as const,
            valor: r.totalPago,
            data: `${r.dataRetirada} 09:30:00`
          })),
        multasEmAberto,
        totalPendente: multasEmAberto.reduce((soma, m) => soma + m.valor - m.valorPago, 0)
      };
    }
  };
}

/** Alguns CEPs de exemplo; os outros respondem "não encontrado", como o ViaCEP. */
const CEPS: Record<string, EnderecoDTO> = {
  '01310100': {
    cep: '01310100',
    rua: 'Avenida Paulista',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
    complemento: 'de 612 a 1510 - lado par'
  },
  '88015000': {
    cep: '88015000',
    rua: 'Rua Felipe Schmidt',
    bairro: 'Centro',
    cidade: 'Florianópolis',
    uf: 'SC'
  },
  '20040002': {
    cep: '20040002',
    rua: 'Rua da Assembleia',
    bairro: 'Centro',
    cidade: 'Rio de Janeiro',
    uf: 'RJ'
  },
  '70040010': {
    cep: '70040010',
    rua: 'Esplanada dos Ministérios',
    bairro: 'Zona Cívico-Administrativa',
    cidade: 'Brasília',
    uf: 'DF'
  }
};

export function simularIntegracoes(): Simulacao {
  return {
    buscarCep: ({ cep }: BuscarCepDTO): EnderecoDTO => {
      const endereco = CEPS[somenteDigitos(cep)];
      if (!endereco) {
        throw new ErroSimulado({
          codigo: 'NAO_ENCONTRADO',
          mensagem: 'CEP não encontrado. Confira os números ou preencha o endereço à mão.'
        });
      }
      return endereco;
    }
  };
}
