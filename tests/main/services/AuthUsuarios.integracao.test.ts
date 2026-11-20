import { afterAll, describe, expect, it } from 'vitest';
import { Configuracao } from '../../../src/main/config/Configuracao';
import { Database, type Executor } from '../../../src/main/database/Database';
import { criarRepositorios } from '../../../src/main/repositories';
import { HashSenha } from '../../../src/main/security/HashSenha';
import { LimiteTentativas } from '../../../src/main/security/LimiteTentativas';
import { Sessao } from '../../../src/main/security/Sessao';
import { AuthService } from '../../../src/main/services/AuthService';
import { UsuarioService } from '../../../src/main/services/UsuarioService';

/**
 * Login e cadastro de usuários contra o MySQL de verdade, com os dados do seed.
 * Só rodam com: DB_TESTE=1 npm test (depois do `npm run db:setup`).
 *
 * Cada teste roda numa transação DESFEITA no final: nada fica gravado no banco.
 */
Configuracao.carregarArquivoEnv();
const habilitado = process.env['DB_TESTE'] === '1';

class Desfazer extends Error {}

describe.skipIf(!habilitado)('Login e usuários (integração com MySQL)', () => {
  const db = habilitado ? new Database(new Configuracao().banco()) : (null as unknown as Database);

  afterAll(async () => {
    await db?.fechar();
  });

  /** Monta os services numa transação e faz ROLLBACK no fim. */
  async function semGravar(
    fn: (s: {
      auth: AuthService;
      usuarios: UsuarioService;
      sessao: Sessao;
      tx: Executor;
    }) => Promise<void>
  ): Promise<void> {
    await expect(
      db.transacao(async (tx) => {
        const repo = criarRepositorios(tx).usuarios;
        const sessao = new Sessao();
        const hash = new HashSenha();
        await fn({
          tx,
          sessao,
          auth: new AuthService(repo, sessao, hash, new LimiteTentativas()),
          usuarios: new UsuarioService(repo, hash, sessao)
        });
        throw new Desfazer();
      })
    ).rejects.toBeInstanceOf(Desfazer);
  }

  it('entra com os logins do seed e recusa senha errada', () =>
    semGravar(async ({ auth }) => {
      const admin = await auth.login({ email: 'admin@aluguel.local', senha: 'Admin@2026' });
      expect(admin).toEqual({
        id: 1,
        nome: 'Administrador',
        email: 'admin@aluguel.local',
        perfil: 'ADMIN'
      });
      const func = await auth.login({ email: 'funcionario@aluguel.local', senha: 'Func@2026' });
      expect(func.perfil).toBe('FUNCIONARIO');

      await expect(auth.login({ email: 'admin@aluguel.local', senha: 'errada' })).rejects.toThrow(
        'E-mail ou senha incorretos.'
      );
    }));

  it('cria, filtra, edita e exclui um usuário; o banco guarda só o hash', () =>
    semGravar(async ({ auth, usuarios, tx }) => {
      await auth.login({ email: 'admin@aluguel.local', senha: 'Admin@2026' });

      const novo = await usuarios.criar({
        nome: 'Teste Integração',
        email: 'teste.integracao@aluguel.local',
        senha: 'Senha@123',
        perfil: 'FUNCIONARIO'
      });
      expect(novo).toMatchObject({ ativo: true, perfil: 'FUNCIONARIO' });
      expect(novo).not.toHaveProperty('senhaHash');

      const [linha] = await tx.consultar<{ senha_hash: string }>(
        'SELECT senha_hash FROM usuarios WHERE id = ?',
        [novo.id]
      );
      expect(linha?.senha_hash).toMatch(/^\$2[aby]\$10\$/);

      const busca = await usuarios.listar({ busca: 'integração', perfil: 'FUNCIONARIO' });
      expect(busca.map((u) => u.id)).toEqual([novo.id]);

      const desativado = await usuarios.atualizar({ id: novo.id, ativo: false });
      expect(desativado.ativo).toBe(false);
      expect((await usuarios.listar({ ativo: false })).map((u) => u.id)).toContain(novo.id);

      await usuarios.excluir(novo.id);
      expect((await usuarios.listar({ busca: 'integração' })).length).toBe(0);
    }));

  it('não exclui usuário do seed que já registrou reservas', () =>
    semGravar(async ({ auth, usuarios }) => {
      await auth.login({ email: 'admin@aluguel.local', senha: 'Admin@2026' });
      await expect(usuarios.excluir(2)).rejects.toThrow(/já registrou \d+ reserva/);
    }));

  it('troca a senha de verdade e o login passa a usar a nova', () =>
    semGravar(async ({ auth }) => {
      await auth.login({ email: 'funcionario@aluguel.local', senha: 'Func@2026' });
      await auth.alterarSenha({ senhaAtual: 'Func@2026', novaSenha: 'Trocada@2026' });
      auth.logout();
      await expect(
        auth.login({ email: 'funcionario@aluguel.local', senha: 'Func@2026' })
      ).rejects.toThrow('E-mail ou senha incorretos.');
      expect(
        (await auth.login({ email: 'funcionario@aluguel.local', senha: 'Trocada@2026' })).id
      ).toBe(2);
    }));
});
