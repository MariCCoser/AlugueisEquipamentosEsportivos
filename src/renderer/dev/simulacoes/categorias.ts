import type {
  AtualizarCategoriaDTO,
  CategoriaDTO,
  CriarCategoriaDTO
} from '@shared/dto/categoria.dto';
import type { IdDTO } from '@shared/dto';
import { ErroSimulado, type Simulacao } from '../apiSimulada';

/**
 * Categorias em memória (só em desenvolvimento), imitando as regras do
 * CategoriaService: nome obrigatório e único, e não excluir categoria em uso.
 */
export function simularCategorias(): Simulacao {
  let proximoId = 6;
  let categorias: CategoriaDTO[] = [
    {
      id: 1,
      nome: 'Bicicletas',
      descricao: 'Mountain bike e urbana',
      sensivelClima: true,
      qtdEquipamentos: 4
    },
    { id: 2, nome: 'Caiaques', descricao: undefined, sensivelClima: true, qtdEquipamentos: 2 },
    {
      id: 3,
      nome: 'Bolas',
      descricao: 'Futebol, vôlei e basquete',
      sensivelClima: false,
      qtdEquipamentos: 6
    },
    { id: 4, nome: 'Raquetes', descricao: undefined, sensivelClima: false, qtdEquipamentos: 0 },
    {
      id: 5,
      nome: 'Pranchas de surfe',
      descricao: undefined,
      sensivelClima: true,
      qtdEquipamentos: 0
    }
  ];

  const normalizar = (texto: string): string =>
    texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

  const obter = (id: number): CategoriaDTO => {
    const categoria = categorias.find((c) => c.id === id);
    if (!categoria) {
      throw new ErroSimulado({
        codigo: 'NAO_ENCONTRADO',
        mensagem: `Categoria #${id} não encontrado(a).`
      });
    }
    return categoria;
  };

  const validarNome = (nome: string | undefined, idAtual?: number): string => {
    const limpo = (nome ?? '').trim();
    if (limpo.length < 2) {
      const mensagem = limpo ? 'Nome deve ter pelo menos 2 letras.' : 'Nome é obrigatório.';
      throw new ErroSimulado({
        codigo: 'VALIDACAO',
        mensagem: 'Dados inválidos. Confira os campos destacados.',
        campos: { nome: mensagem }
      });
    }
    const repetida = categorias.find((c) => normalizar(c.nome) === normalizar(limpo));
    if (repetida && repetida.id !== idAtual) {
      throw new ErroSimulado({
        codigo: 'REGRA_NEGOCIO',
        mensagem: 'Já existe uma categoria com esse nome.'
      });
    }
    return limpo;
  };

  return {
    listar: () => [...categorias].sort((a, b) => a.nome.localeCompare(b.nome)),
    buscarPorId: ({ id }: IdDTO) => obter(id),
    criar: (dados: CriarCategoriaDTO) => {
      const nova: CategoriaDTO = {
        id: proximoId++,
        nome: validarNome(dados.nome),
        descricao: dados.descricao?.trim() || undefined,
        sensivelClima: dados.sensivelClima ?? false,
        qtdEquipamentos: 0
      };
      categorias.push(nova);
      return nova;
    },
    atualizar: ({ id, ...dados }: AtualizarCategoriaDTO) => {
      const categoria = obter(id);
      if (dados.nome !== undefined) categoria.nome = validarNome(dados.nome, id);
      if ('descricao' in dados) categoria.descricao = dados.descricao?.trim() || undefined;
      if (dados.sensivelClima !== undefined) categoria.sensivelClima = dados.sensivelClima;
      return categoria;
    },
    excluir: ({ id }: IdDTO) => {
      const categoria = obter(id);
      if (categoria.qtdEquipamentos > 0) {
        throw new ErroSimulado({
          codigo: 'REGRA_NEGOCIO',
          mensagem: `Não é possível excluir "${categoria.nome}": ${categoria.qtdEquipamentos} equipamento(s) usam esta categoria.`
        });
      }
      categorias = categorias.filter((c) => c.id !== id);
    }
  };
}
