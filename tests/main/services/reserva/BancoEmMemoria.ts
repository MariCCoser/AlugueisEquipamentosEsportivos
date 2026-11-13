import type {
  Cliente,
  Equipamento,
  Fornecedor,
  ItemReserva,
  Manutencao,
  Multa,
  NovaReserva,
  Pagamento,
  Reserva
} from '../../../../src/shared/models/entidades';
import type { DataISO, Paginado } from '../../../../src/shared/dto/resposta';
import type {
  EstadoConservacao,
  FormaPagamento,
  StatusEquipamento,
  StatusReserva,
  TipoFornecedor,
  TipoPagamento
} from '../../../../src/shared/models/enums';
import type { Repositorios } from '../../../../src/main/repositories';
import type { FiltroReservas } from '../../../../src/main/repositories/ReservaRepository';
import type { AcessoDados } from '../../../../src/main/services/UnidadeDeTrabalho';

const DATAS = { createdAt: '2026-11-01 10:00:00', updatedAt: '2026-11-01 10:00:00' };

interface Tabelas {
  clientes: Cliente[];
  equipamentos: Equipamento[];
  reservas: Reserva[];
  itens: ItemReserva[];
  manutencoes: Manutencao[];
  pagamentos: Pagamento[];
  multas: Multa[];
  fornecedores: Fornecedor[];
}

/**
 * "Banco" em memória com só os métodos de repositório que os services de
 * reserva usam. `transacao` tira uma cópia das tabelas e, se a função lançar
 * erro, restaura a cópia — igual ao ROLLBACK do MySQL. Assim os testes
 * conferem que nada fica gravado pela metade.
 */
export class BancoEmMemoria implements AcessoDados {
  t: Tabelas = {
    clientes: [],
    equipamentos: [],
    reservas: [],
    itens: [],
    manutencoes: [],
    pagamentos: [],
    multas: [],
    fornecedores: []
  };
  private proximoId = 100;
  /** Quantas transações foram abertas (para conferir que a operação usou uma). */
  transacoes = 0;
  readonly repos: Repositorios = this.criarRepos();

  async transacao<T>(fn: (repos: Repositorios) => Promise<T>): Promise<T> {
    this.transacoes++;
    const copia = structuredClone(this.t);
    try {
      return await fn(this.repos);
    } catch (erro) {
      this.t = copia;
      throw erro;
    }
  }

  // ---------- montar cenários ----------

  cliente(extra: Partial<Cliente> = {}): Cliente {
    const c: Cliente = {
      id: this.id(),
      nome: 'Ana Souza',
      cpf: '52998224725',
      telefone: '11987654321',
      email: null,
      cep: '01310100',
      rua: 'Av. Paulista',
      numero: '1',
      complemento: null,
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP',
      ...DATAS,
      ...extra
    };
    this.t.clientes.push(c);
    return c;
  }

  equipamento(extra: Partial<Equipamento> = {}): Equipamento {
    const e: Equipamento = {
      id: this.id(),
      nome: 'Bike',
      descricao: null,
      modalidade: 'LOCACAO',
      estadoConservacao: 'MUITO_BOM',
      status: 'DISPONIVEL',
      valorDiaria: 45,
      precoVenda: null,
      dataAquisicao: null,
      categoriaId: 1,
      fornecedorId: null,
      ...DATAS,
      ...extra
    };
    this.t.equipamentos.push(e);
    return e;
  }

  manutencaoAberta(equipamentoId: number): void {
    this.t.manutencoes.push({
      id: this.id(),
      equipamentoId,
      fornecedorId: 1,
      tipo: 'CORRETIVA',
      descricao: 'x',
      dataEnvio: '2026-11-01',
      dataRetorno: null,
      custo: null,
      estadoRetorno: null,
      ...DATAS
    });
  }

  pagamento(
    reservaId: number,
    valor: number,
    tipo: TipoPagamento = 'ALUGUEL',
    forma: FormaPagamento = 'PIX',
    multaId: number | null = null
  ): Pagamento {
    const pg: Pagamento = {
      id: this.id(),
      reservaId,
      multaId,
      tipo,
      forma,
      valor,
      data: '2026-11-13 10:00:00',
      ...DATAS
    };
    this.t.pagamentos.push(pg);
    return pg;
  }

  fornecedor(tipo: TipoFornecedor, extra: Partial<Fornecedor> = {}): Fornecedor {
    const f: Fornecedor = {
      id: this.id(),
      razaoSocial: tipo === 'COMPRA' ? 'Distribuidora' : 'Oficina',
      cnpj: String(this.proximoId).padStart(14, '0'),
      tipo,
      contato: null,
      telefone: null,
      email: null,
      ...DATAS,
      ...extra
    };
    this.t.fornecedores.push(f);
    return f;
  }

  multa(reservaId: number, valor: number): Multa {
    const m: Multa = {
      id: this.id(),
      reservaId,
      diasAtraso: 1,
      valor,
      quitada: false,
      dataQuitacao: null,
      ...DATAS
    };
    this.t.multas.push(m);
    return m;
  }

  equip(id: number): Equipamento {
    return this.t.equipamentos.find((e) => e.id === id)!;
  }

  reserva(id: number): Reserva {
    return this.t.reservas.find((r) => r.id === id)!;
  }

  itensDa(reservaId: number): ItemReserva[] {
    return this.t.itens.filter((i) => i.reservaId === reservaId);
  }

  // ---------- repositórios ----------

  private id(): number {
    return this.proximoId++;
  }

  private criarRepos(): Repositorios {
    const b = () => this.t;
    const copiar = <T>(x: T | undefined): T | null => (x ? { ...x } : null);
    const ocupam = (s: StatusReserva) => s === 'PENDENTE' || s === 'ATIVA';

    const reservas = {
      travar: async (id: number) => copiar(b().reservas.find((r) => r.id === id)),
      buscarPorId: async (id: number) => copiar(b().reservas.find((r) => r.id === id)),
      criar: async (novo: NovaReserva) => {
        const r = { dataDevolucaoReal: null, ...novo, id: this.id(), ...DATAS } as Reserva;
        b().reservas.push(r);
        return { ...r };
      },
      atualizar: async (id: number, dados: Partial<Reserva>) => {
        const r = b().reservas.find((x) => x.id === id);
        if (!r) return null;
        for (const [k, v] of Object.entries(dados))
          if (v !== undefined) Object.assign(r, { [k]: v });
        return { ...r };
      },
      atualizarStatus: async (id: number, status: StatusReserva) => {
        const r = b().reservas.find((x) => x.id === id);
        if (r) r.status = status;
        return !!r;
      },
      excluir: async (id: number) => {
        b().itens = b().itens.filter((i) => i.reservaId !== id); // ON DELETE CASCADE
        b().reservas = b().reservas.filter((r) => r.id !== id);
        return true;
      },
      filtrar: async (f: FiltroReservas = {}): Promise<Paginado<Reserva>> => {
        const itens = b().reservas.filter(
          (r) =>
            (!f.status || r.status === f.status) &&
            (f.clienteId === undefined || r.clienteId === f.clienteId)
        );
        return { itens, total: itens.length, pagina: 1, porPagina: 20 };
      },
      listarPorStatus: async (status: StatusReserva) =>
        b().reservas.filter((r) => r.status === status),
      listarPorCliente: async (clienteId: number) =>
        b().reservas.filter((r) => r.clienteId === clienteId),
      listarAtrasadas: async (hoje: DataISO) =>
        b().reservas.filter((r) => r.status === 'ATIVA' && r.dataDevolucaoPrevista < hoje),
      // Mesma regra do SQL da Pessoa 1: bordas inclusivas, só PENDENTE/ATIVA
      equipamentoReservadoNoPeriodo: async (
        equipamentoId: number,
        inicio: DataISO,
        fim: DataISO,
        ignorar?: number
      ) =>
        b().itens.some((i) => {
          const r = b().reservas.find((x) => x.id === i.reservaId)!;
          return (
            i.equipamentoId === equipamentoId &&
            ocupam(r.status) &&
            r.id !== ignorar &&
            r.dataRetirada <= fim &&
            r.dataDevolucaoPrevista >= inicio
          );
        })
    };

    const itensReserva = {
      travarDaReserva: async (reservaId: number) =>
        b()
          .itens.filter((i) => i.reservaId === reservaId)
          .map((i) => ({ ...i })),
      listarPorReserva: async (reservaId: number) =>
        b()
          .itens.filter((i) => i.reservaId === reservaId)
          .map((i) => ({ ...i })),
      buscarPorId: async (id: number) => copiar(b().itens.find((i) => i.id === id)),
      criar: async (
        novo: Omit<ItemReserva, 'id' | 'createdAt' | 'updatedAt' | 'estadoDevolucao'>
      ) => {
        const item: ItemReserva = { estadoDevolucao: null, ...novo, id: this.id(), ...DATAS };
        b().itens.push(item);
        return { ...item };
      },
      atualizar: async (id: number, dados: Partial<ItemReserva>) => {
        const item = b().itens.find((i) => i.id === id);
        if (!item) return null;
        Object.assign(item, dados);
        return { ...item };
      },
      excluir: async (id: number) => {
        b().itens = b().itens.filter((i) => i.id !== id);
        return true;
      },
      registrarDevolucao: async (id: number, estado: EstadoConservacao) => {
        const item = b().itens.find((i) => i.id === id);
        if (item) item.estadoDevolucao = estado;
        return !!item;
      },
      excluirDaReserva: async (reservaId: number) => {
        const antes = b().itens.length;
        b().itens = b().itens.filter((i) => i.reservaId !== reservaId);
        return antes - b().itens.length;
      }
    };

    const equipamentos = {
      travarPorIds: async (ids: number[]) =>
        b()
          .equipamentos.filter((e) => ids.includes(e.id))
          .sort((x, y) => x.id - y.id)
          .map((e) => ({ ...e })),
      buscarPorIds: async (ids: number[]) =>
        b()
          .equipamentos.filter((e) => ids.includes(e.id))
          .map((e) => ({ ...e })),
      buscarPorId: async (id: number) => copiar(b().equipamentos.find((e) => e.id === id)),
      atualizar: async (id: number, dados: Partial<Equipamento>) => {
        const e = b().equipamentos.find((x) => x.id === id);
        if (!e) return null;
        Object.assign(e, dados);
        return { ...e };
      },
      atualizarStatus: async (id: number, status: StatusEquipamento) => {
        const e = b().equipamentos.find((x) => x.id === id);
        if (e) e.status = status;
        return !!e;
      }
    };

    return {
      reservas,
      itensReserva,
      equipamentos,
      clientes: {
        buscarPorId: async (id: number) => copiar(b().clientes.find((c) => c.id === id))
      },
      fornecedores: {
        buscarPorId: async (id: number) => copiar(b().fornecedores.find((f) => f.id === id)),
        listarPorTipo: async (tipo: TipoFornecedor) =>
          b().fornecedores.filter((f) => f.tipo === tipo)
      },
      manutencoes: {
        buscarEmAbertoDoEquipamento: async (id: number) =>
          copiar(b().manutencoes.find((m) => m.equipamentoId === id && m.dataRetorno === null)),
        buscarPorId: async (id: number) => copiar(b().manutencoes.find((m) => m.id === id)),
        criar: async (novo: Partial<Manutencao>) => {
          const m = {
            dataRetorno: null,
            custo: null,
            estadoRetorno: null,
            ...novo,
            id: this.id(),
            ...DATAS
          } as Manutencao;
          b().manutencoes.push(m);
          return { ...m };
        },
        atualizar: async (id: number, dados: Partial<Manutencao>) => {
          const m = b().manutencoes.find((x) => x.id === id);
          if (!m) return null;
          for (const [k, v] of Object.entries(dados))
            if (v !== undefined) Object.assign(m, { [k]: v });
          return { ...m };
        },
        registrarRetorno: async (id: number, dados: Partial<Manutencao>) => {
          const m = b().manutencoes.find((x) => x.id === id);
          if (!m) return null;
          Object.assign(m, dados);
          return { ...m };
        },
        excluir: async (id: number) => {
          b().manutencoes = b().manutencoes.filter((m) => m.id !== id);
          return true;
        },
        filtrar: async (f: { abertas?: boolean } = {}) =>
          b().manutencoes.filter(
            (m) => f.abertas === undefined || (m.dataRetorno === null) === f.abertas
          ),
        listarEmAberto: async () => b().manutencoes.filter((m) => m.dataRetorno === null),
        listarPorEquipamento: async (id: number) =>
          b().manutencoes.filter((m) => m.equipamentoId === id)
      },
      pagamentos: {
        somarPorReserva: async (id: number, tipo?: TipoPagamento) =>
          b()
            .pagamentos.filter((p) => p.reservaId === id && (!tipo || p.tipo === tipo))
            .reduce((s, p) => s + p.valor, 0),
        somarPorMulta: async (id: number) =>
          b()
            .pagamentos.filter((p) => p.multaId === id)
            .reduce((s, p) => s + p.valor, 0),
        buscarPorId: async (id: number) => copiar(b().pagamentos.find((p) => p.id === id)),
        listarPorReserva: async (id: number) =>
          b()
            .pagamentos.filter((p) => p.reservaId === id)
            .map((p) => ({ ...p })),
        listarPorMulta: async (id: number) => b().pagamentos.filter((p) => p.multaId === id),
        filtrar: async (f: { tipo?: TipoPagamento } = {}) =>
          b().pagamentos.filter((p) => !f.tipo || p.tipo === f.tipo),
        criar: async (novo: Partial<Pagamento>) => {
          const pg = {
            multaId: null,
            data: '2026-11-13 12:00:00',
            ...novo,
            id: this.id(),
            ...DATAS
          } as Pagamento;
          b().pagamentos.push(pg);
          return { ...pg };
        },
        atualizar: async (id: number, dados: Partial<Pagamento>) => {
          const pg = b().pagamentos.find((x) => x.id === id);
          if (!pg) return null;
          for (const [k, v] of Object.entries(dados))
            if (v !== undefined) Object.assign(pg, { [k]: v });
          return { ...pg };
        },
        excluir: async (id: number) => {
          b().pagamentos = b().pagamentos.filter((p) => p.id !== id);
          return true;
        }
      },
      multas: {
        buscarPorReserva: async (id: number) => copiar(b().multas.find((m) => m.reservaId === id)),
        buscarPorId: async (id: number) => copiar(b().multas.find((m) => m.id === id)),
        criar: async (novo: Partial<Multa>) => {
          if (b().multas.some((m) => m.reservaId === novo.reservaId)) {
            throw Object.assign(new Error('duplicada'), { code: 'ER_DUP_ENTRY' });
          }
          const m = {
            quitada: false,
            dataQuitacao: null,
            ...novo,
            id: this.id(),
            ...DATAS
          } as Multa;
          b().multas.push(m);
          return { ...m };
        },
        atualizar: async (id: number, dados: Partial<Multa>) => {
          const m = b().multas.find((x) => x.id === id);
          if (!m) return null;
          for (const [k, v] of Object.entries(dados))
            if (v !== undefined) Object.assign(m, { [k]: v });
          return { ...m };
        },
        excluir: async (id: number) => {
          b().multas = b().multas.filter((m) => m.id !== id);
          return true;
        },
        quitar: async (id: number) => {
          const m = b().multas.find((x) => x.id === id && !x.quitada);
          if (m) Object.assign(m, { quitada: true, dataQuitacao: '2026-11-13 12:00:00' });
          return !!m;
        },
        reabrir: async (id: number) => {
          const m = b().multas.find((x) => x.id === id && x.quitada);
          if (m) Object.assign(m, { quitada: false, dataQuitacao: null });
          return !!m;
        },
        filtrar: async (f: { quitada?: boolean } = {}) =>
          b().multas.filter((m) => f.quitada === undefined || m.quitada === f.quitada),
        listarEmAberto: async () => b().multas.filter((m) => !m.quitada)
      }
    } as unknown as Repositorios;
  }
}
