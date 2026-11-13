import type { ContagemTabelaDTO } from '@shared/dto/banco.dto';
import type { Executor } from './Database';

/** As 10 tabelas do sistema, na ordem de criação (respeitando as FKs). */
export const TABELAS = [
  'usuarios',
  'clientes',
  'categorias',
  'fornecedores',
  'equipamentos',
  'reservas',
  'itens_reserva',
  'manutencoes',
  'multas',
  'pagamentos'
] as const;

/** Conta os registros de cada tabela — usado pela tela inicial e pelo `npm run db:status`. */
export class DiagnosticoBanco {
  constructor(private readonly db: Executor) {}

  async contarRegistros(): Promise<ContagemTabelaDTO[]> {
    const contagens: ContagemTabelaDTO[] = [];
    // Nome de tabela não pode ser placeholder (?); por isso só usamos nomes da lista fixa acima
    for (const tabela of TABELAS) {
      const [linha] = await this.db.consultar<{ total: number }>(
        `SELECT COUNT(*) AS total FROM ${tabela}`
      );
      contagens.push({ tabela, registros: Number(linha?.total ?? 0) });
    }
    return contagens;
  }
}
