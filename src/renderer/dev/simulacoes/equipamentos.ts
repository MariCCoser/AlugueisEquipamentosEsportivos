import type { IdDTO } from '@shared/dto';
import type {
  AlterarStatusEquipamentoDTO,
  AtualizarEquipamentoDTO,
  CriarEquipamentoDTO,
  EquipamentoDTO,
  FiltroEquipamentoDTO
} from '@shared/dto/equipamento.dto';
import type { Paginado } from '@shared/dto/resposta';
import { ErroSimulado, type Simulacao } from '../apiSimulada';

/** Mesmos ids das categorias e fornecedores simulados (simulacoes/categorias e fornecedores). */
const CATEGORIAS: Record<number, { nome: string; sensivelClima: boolean }> = {
  1: { nome: 'Bicicletas', sensivelClima: true },
  2: { nome: 'Caiaques', sensivelClima: true },
  3: { nome: 'Bolas', sensivelClima: false },
  4: { nome: 'Raquetes', sensivelClima: false },
  5: { nome: 'Pranchas de surfe', sensivelClima: true }
};
const FORNECEDORES: Record<number, string> = {
  1: 'Esporte Total Distribuidora Ltda',
  2: 'Aventura Equipamentos Ltda'
};

type Base = Omit<EquipamentoDTO, 'categoriaNome' | 'sensivelClima' | 'fornecedorNome'>;

/**
 * Inventário em memória (só em desenvolvimento), parecido com o seed, com as regras
 * principais do EquipamentoService: preço conforme a modalidade, status manual só
 * entre DISPONIVEL e INDISPONIVEL, e não excluir item com histórico.
 */
export function simularEquipamentos(): Simulacao {
  let proximoId = 26;
  const base: Base[] = [
    {
      id: 1,
      nome: 'Mountain Bike Aro 29',
      descricao: '21 marchas, suspensão dianteira',
      modalidade: 'LOCACAO',
      estadoConservacao: 'MUITO_BOM',
      status: 'RESERVADO',
      valorDiaria: 45,
      dataAquisicao: '2025-10-13',
      categoriaId: 1,
      fornecedorId: 1
    },
    {
      id: 2,
      nome: 'Bicicleta Speed Carbono',
      descricao: 'Quadro de carbono, 22 marchas',
      modalidade: 'LOCACAO',
      estadoConservacao: 'NOVO',
      status: 'DISPONIVEL',
      valorDiaria: 80,
      dataAquisicao: '2026-08-19',
      categoriaId: 1,
      fornecedorId: 1
    },
    {
      id: 3,
      nome: 'Bicicleta Urbana Aro 26',
      descricao: 'Com cestinha',
      modalidade: 'LOCACAO',
      estadoConservacao: 'MEDIO',
      status: 'EM_MANUTENCAO',
      valorDiaria: 30,
      categoriaId: 1,
      fornecedorId: 1
    },
    {
      id: 4,
      nome: 'Caiaque Individual',
      descricao: 'Inclui remo e colete',
      modalidade: 'LOCACAO',
      estadoConservacao: 'MUITO_BOM',
      status: 'RESERVADO',
      valorDiaria: 90,
      categoriaId: 2,
      fornecedorId: 2
    },
    {
      id: 5,
      nome: 'Caiaque Duplo',
      descricao: 'Inclui 2 remos e 2 coletes',
      modalidade: 'LOCACAO',
      estadoConservacao: 'MUITO_BOM',
      status: 'DISPONIVEL',
      valorDiaria: 120,
      categoriaId: 2,
      fornecedorId: 2
    },
    {
      id: 6,
      nome: 'Prancha de Surf 6\'2"',
      descricao: 'Epóxi, com quilhas',
      modalidade: 'LOCACAO',
      estadoConservacao: 'MEDIO',
      status: 'DISPONIVEL',
      valorDiaria: 50,
      categoriaId: 5,
      fornecedorId: 2
    },
    {
      id: 7,
      nome: 'Prancha de Stand Up Paddle',
      descricao: 'Inflável, com remo',
      modalidade: 'LOCACAO',
      estadoConservacao: 'MUITO_BOM',
      status: 'RESERVADO',
      valorDiaria: 70,
      categoriaId: 5,
      fornecedorId: 2
    },
    {
      id: 8,
      nome: 'Raquete de Tênis Profissional',
      descricao: 'Cabo 3, encordoada',
      modalidade: 'LOCACAO',
      estadoConservacao: 'NOVO',
      status: 'DISPONIVEL',
      valorDiaria: 20,
      categoriaId: 4,
      fornecedorId: 1
    },
    {
      id: 9,
      nome: 'Kit Beach Tennis',
      descricao: '2 raquetes + 3 bolas',
      modalidade: 'LOCACAO',
      estadoConservacao: 'MUITO_BOM',
      status: 'INDISPONIVEL',
      valorDiaria: 25,
      categoriaId: 4,
      fornecedorId: 1
    },
    {
      id: 12,
      nome: 'Bola de Futebol Oficial',
      descricao: 'Tamanho 5',
      modalidade: 'VENDA',
      estadoConservacao: 'NOVO',
      status: 'DISPONIVEL',
      precoVenda: 149.9,
      categoriaId: 3,
      fornecedorId: 1
    },
    {
      id: 13,
      nome: 'Bola de Vôlei de Praia',
      modalidade: 'VENDA',
      estadoConservacao: 'NOVO',
      status: 'DISPONIVEL',
      precoVenda: 119.9,
      categoriaId: 3
    }
  ];
  // Mais raquetes de aluguel, para a lista passar de uma página (20 por página).
  for (let i = 1; i <= 12; i++) {
    base.push({
      id: 13 + i,
      nome: `Raquete de Squash nº ${String(i).padStart(2, '0')}`,
      modalidade: 'LOCACAO',
      estadoConservacao: i % 3 === 0 ? 'REGULAR' : 'MUITO_BOM',
      status: 'DISPONIVEL',
      valorDiaria: 15,
      categoriaId: 4
    });
  }
  let equipamentos = base;
  /** Itens que já foram alugados ou passaram por manutenção (não podem ser excluídos). */
  const comHistorico = new Set([1, 3, 4, 7]);

  const paraDTO = (e: Base): EquipamentoDTO => {
    const categoria = CATEGORIAS[e.categoriaId];
    return {
      ...e,
      categoriaNome: categoria?.nome ?? '',
      sensivelClima: categoria?.sensivelClima ?? false,
      ...(e.fornecedorId ? { fornecedorNome: FORNECEDORES[e.fornecedorId] } : {})
    };
  };

  const obter = (id: number): Base => {
    const equipamento = equipamentos.find((e) => e.id === id);
    if (!equipamento) {
      throw new ErroSimulado({
        codigo: 'NAO_ENCONTRADO',
        mensagem: `Equipamento #${id} não encontrado(a).`
      });
    }
    return equipamento;
  };

  const validarPreco = (e: Base): void => {
    if (e.modalidade === 'LOCACAO' && !(e.valorDiaria && e.valorDiaria > 0)) {
      throw new ErroSimulado({
        codigo: 'VALIDACAO',
        mensagem: 'Equipamento para locação precisa de valor da diária.',
        campos: { valorDiaria: 'Informe um valor maior que zero.' }
      });
    }
    if (e.modalidade === 'VENDA' && !(e.precoVenda && e.precoVenda > 0)) {
      throw new ErroSimulado({
        codigo: 'VALIDACAO',
        mensagem: 'Equipamento para venda precisa de preço de venda.',
        campos: { precoVenda: 'Informe um valor maior que zero.' }
      });
    }
  };

  return {
    listar: (filtro: FiltroEquipamentoDTO = {}): Paginado<EquipamentoDTO> => {
      const busca = filtro.busca?.toLowerCase() ?? '';
      const encontrados = equipamentos
        .filter((e) => !filtro.categoriaId || e.categoriaId === filtro.categoriaId)
        .filter((e) => !filtro.status || e.status === filtro.status)
        .filter((e) => !filtro.modalidade || e.modalidade === filtro.modalidade)
        .filter(
          (e) => !filtro.estadoConservacao || e.estadoConservacao === filtro.estadoConservacao
        )
        .filter((e) => !busca || e.nome.toLowerCase().includes(busca))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      const porPagina = filtro.porPagina ?? 20;
      const pagina = filtro.pagina ?? 1;
      return {
        itens: encontrados.slice((pagina - 1) * porPagina, pagina * porPagina).map(paraDTO),
        total: encontrados.length,
        pagina,
        porPagina
      };
    },
    buscarPorId: ({ id }: IdDTO) => paraDTO(obter(id)),
    criar: (dados: CriarEquipamentoDTO) => {
      const novo: Base = {
        ...dados,
        descricao: dados.descricao?.trim() || undefined,
        id: proximoId++,
        status: 'DISPONIVEL'
      };
      validarPreco(novo);
      equipamentos.push(novo);
      return paraDTO(novo);
    },
    atualizar: ({ id, ...dados }: AtualizarEquipamentoDTO) => {
      const atual = obter(id);
      const final: Base = { ...atual, ...dados };
      if (dados.descricao !== undefined) final.descricao = dados.descricao.trim() || undefined;
      validarPreco(final);
      if (final.modalidade !== atual.modalidade && atual.status === 'RESERVADO') {
        throw new ErroSimulado({
          codigo: 'REGRA_NEGOCIO',
          mensagem: 'Não é possível mudar a modalidade de um item reservado.'
        });
      }
      Object.assign(atual, final);
      return paraDTO(atual);
    },
    /**
     * Só para as outras simulações (reserva, devolução, manutenção) mudarem o status
     * e o estado do item, como as regras do Main fazem. Não existe no window.api real.
     */
    _definirStatus: ({
      id,
      status,
      estadoConservacao
    }: Pick<Base, 'id' | 'status'> & Partial<Pick<Base, 'estadoConservacao'>>) => {
      const atual = obter(id);
      atual.status = status;
      if (estadoConservacao) atual.estadoConservacao = estadoConservacao;
    },
    alterarStatus: ({ id, status }: AlterarStatusEquipamentoDTO) => {
      const atual = obter(id);
      if (atual.status === 'RESERVADO' || atual.status === 'EM_MANUTENCAO') {
        throw new ErroSimulado({
          codigo: 'REGRA_NEGOCIO',
          mensagem:
            atual.status === 'RESERVADO'
              ? 'O equipamento está reservado: ele volta a ficar disponível na devolução.'
              : 'O equipamento está em manutenção: registre o retorno da manutenção.'
        });
      }
      atual.status = status;
      return paraDTO(atual);
    },
    excluir: ({ id }: IdDTO) => {
      obter(id);
      if (comHistorico.has(id)) {
        throw new ErroSimulado({
          codigo: 'REGRA_NEGOCIO',
          mensagem:
            'Não é possível excluir: o equipamento tem reservas ou manutenções no histórico. ' +
            'Marque-o como INDISPONIVEL.'
        });
      }
      equipamentos = equipamentos.filter((e) => e.id !== id);
    }
  };
}
