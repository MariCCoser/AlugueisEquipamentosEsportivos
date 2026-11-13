import type {
  Cliente,
  Equipamento,
  ItemReserva,
  Manutencao,
  Multa,
  NovaReserva,
  Pagamento,
  Reserva
} from '../../../../src/shared/models/entidades';
import type { DataISO, Paginado } from '../../../../src/shared/dto/resposta';
import type { StatusEquipamento, StatusReserva } from '../../../../src/shared/models/enums';
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
    multas: []
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

  pagamento(reservaId: number, valor: number): void {
    this.t.pagamentos.push({
      id: this.id(),
      reservaId,
      multaId: null,
      tipo: 'ALUGUEL',
      forma: 'PIX',
      valor,
      data: '2026-11-13 10:00:00',
      ...DATAS
    });
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
      manutencoes: {
        buscarEmAbertoDoEquipamento: async (id: number) =>
          copiar(b().manutencoes.find((m) => m.equipamentoId === id && m.dataRetorno === null))
      },
      pagamentos: {
        somarPorReserva: async (id: number) =>
          b()
            .pagamentos.filter((p) => p.reservaId === id)
            .reduce((s, p) => s + p.valor, 0),
        somarPorMulta: async (id: number) =>
          b()
            .pagamentos.filter((p) => p.multaId === id)
            .reduce((s, p) => s + p.valor, 0)
      },
      multas: {
        buscarPorReserva: async (id: number) => copiar(b().multas.find((m) => m.reservaId === id))
      }
    } as unknown as Repositorios;
  }
}
