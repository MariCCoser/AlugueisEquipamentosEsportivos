import type { NovoUsuario, Usuario } from '@shared/models/entidades';
import type { Perfil } from '@shared/models/enums';
import type { ParametroSql } from '../database/Database';
import { BaseRepository, escaparLike, type CamposGravaveis } from './BaseRepository';

export interface FiltroUsuario {
  perfil?: Perfil;
  ativo?: boolean;
  /** Parte do nome ou do e-mail. */
  busca?: string;
}

/** Tabela `usuarios`. A entidade tem `senhaHash`: nunca devolver ela direto para o Renderer. */
export class UsuarioRepository extends BaseRepository<Usuario, NovoUsuario> {
  protected readonly tabela = 'usuarios';
  protected readonly campos: CamposGravaveis<NovoUsuario> = {
    nome: true,
    email: true,
    senhaHash: true,
    perfil: true,
    ativo: true,
    ultimoLogin: true
  };
  protected override readonly camposBooleanos = ['ativo'] as const;

  /** Usado no login. O e-mail é comparado sem diferenciar maiúsculas (collation do banco). */
  buscarPorEmail(email: string): Promise<Usuario | null> {
    return this.buscarUm('email = ?', [email.trim()]);
  }

  listarAtivos(): Promise<Usuario[]> {
    return this.selecionar('ativo = 1', [], 'ORDER BY nome, id');
  }

  /** Lista com filtros opcionais (tela Usuários), em ordem de nome. */
  listarFiltrado(filtro: FiltroUsuario = {}): Promise<Usuario[]> {
    const condicoes: string[] = [];
    const params: ParametroSql[] = [];

    if (filtro.perfil) {
      condicoes.push('perfil = ?');
      params.push(filtro.perfil);
    }
    if (filtro.ativo !== undefined) {
      condicoes.push('ativo = ?');
      params.push(filtro.ativo ? 1 : 0);
    }
    const busca = filtro.busca?.trim();
    if (busca) {
      condicoes.push('(nome LIKE ? OR email LIKE ?)');
      const padrao = `%${escaparLike(busca)}%`;
      params.push(padrao, padrao);
    }

    return this.selecionar(condicoes.join(' AND '), params, 'ORDER BY nome, id');
  }

  /** Quantas reservas o usuário registrou (quem tem reservas não pode ser excluído). */
  async contarReservas(usuarioId: number): Promise<number> {
    const [linha] = await this.db.consultar<{ total: number | string }>(
      'SELECT COUNT(*) AS total FROM reservas WHERE usuario_id = ?',
      [usuarioId]
    );
    return Number(linha?.total ?? 0);
  }

  /** Grava a data/hora do último login com o relógio do banco. */
  async registrarLogin(id: number): Promise<void> {
    await this.db.executar('UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?', [id]);
  }
}
