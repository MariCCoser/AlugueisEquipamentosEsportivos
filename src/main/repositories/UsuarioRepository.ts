import type { NovoUsuario, Usuario } from '@shared/models/entidades';
import { BaseRepository, type CamposGravaveis } from './BaseRepository';

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

  /** Grava a data/hora do último login com o relógio do banco. */
  async registrarLogin(id: number): Promise<void> {
    await this.db.executar('UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?', [id]);
  }
}
