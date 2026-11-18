import type { IdDTO } from '@shared/dto';
import type { AlterarSenhaDTO, LoginDTO, UsuarioSessaoDTO } from '@shared/dto/auth.dto';
import type {
  AtualizarUsuarioDTO,
  CriarUsuarioDTO,
  FiltroUsuarioDTO,
  UsuarioDTO
} from '@shared/dto/usuario.dto';
import { ErroSimulado, type Simulacao } from '../apiSimulada';

/**
 * Logins de exemplo do modo simulado: os mesmos documentados no seed
 * (src/main/database/seeds/README.md). Só existem no navegador de desenvolvimento.
 */
const CONTAS: { usuario: UsuarioSessaoDTO; senha: string }[] = [
  {
    usuario: { id: 1, nome: 'Administrador', email: 'admin@aluguel.local', perfil: 'ADMIN' },
    senha: 'Admin@2026'
  },
  {
    usuario: {
      id: 2,
      nome: 'Funcionária Exemplo',
      email: 'funcionario@aluguel.local',
      perfil: 'FUNCIONARIO'
    },
    senha: 'Func@2026'
  }
];

/** Quem está "logado" no modo simulado (como a classe Sessao do Main). */
let logado: UsuarioSessaoDTO | null = null;

export function simularAuth(): Simulacao {
  return {
    sessaoAtual: () => logado,
    login: ({ email, senha }: LoginDTO) => {
      const conta = CONTAS.find((c) => c.usuario.email === email.trim().toLowerCase());
      // Mesma mensagem para e-mail inexistente e senha errada (não revela quem tem conta).
      if (!conta || conta.senha !== senha) {
        throw new ErroSimulado({
          codigo: 'NAO_AUTORIZADO',
          mensagem: 'E-mail ou senha incorretos.'
        });
      }
      logado = { ...conta.usuario };
      return logado;
    },
    logout: () => {
      logado = null;
    },
    alterarSenha: ({ senhaAtual, novaSenha }: AlterarSenhaDTO) => {
      const conta = CONTAS.find((c) => c.usuario.id === logado?.id);
      if (!conta)
        throw new ErroSimulado({
          codigo: 'NAO_AUTORIZADO',
          mensagem: 'Faça login para continuar.'
        });
      if (conta.senha !== senhaAtual) {
        throw new ErroSimulado({
          codigo: 'VALIDACAO',
          mensagem: 'Dados inválidos. Confira os campos destacados.',
          campos: { senhaAtual: 'Senha atual incorreta.' }
        });
      }
      conta.senha = novaSenha;
    }
  };
}

/**
 * Usuários em memória (só em desenvolvimento). Imita o que se espera dos canais
 * usuarios:* da Pessoa 3: e-mail único e não excluir quem já registrou reservas.
 * A senha recebida é descartada (o Main real grava só o hash).
 */
export function simularUsuarios(): Simulacao {
  let proximoId = 5;
  let usuarios: UsuarioDTO[] = [
    {
      id: 1,
      nome: 'Administrador',
      email: 'admin@aluguel.local',
      perfil: 'ADMIN',
      ativo: true,
      ultimoLogin: '2026-11-17 08:12:00',
      createdAt: '2025-08-01 09:00:00'
    },
    {
      id: 2,
      nome: 'Funcionária Exemplo',
      email: 'funcionario@aluguel.local',
      perfil: 'FUNCIONARIO',
      ativo: true,
      ultimoLogin: '2026-11-16 17:40:00',
      createdAt: '2025-08-01 09:00:00'
    },
    {
      id: 3,
      nome: 'Pedro Alves',
      email: 'pedro@aluguel.local',
      perfil: 'FUNCIONARIO',
      ativo: true,
      createdAt: '2026-11-10 10:00:00'
    },
    {
      id: 4,
      nome: 'Rita Gomes',
      email: 'rita@aluguel.local',
      perfil: 'FUNCIONARIO',
      ativo: false,
      ultimoLogin: '2026-02-03 13:05:00',
      createdAt: '2025-09-15 09:00:00'
    }
  ];
  /** Usuários que já registraram reservas (como no seed). */
  const comReservas = new Set([1, 2]);

  const obter = (id: number): UsuarioDTO => {
    const usuario = usuarios.find((u) => u.id === id);
    if (!usuario) {
      throw new ErroSimulado({
        codigo: 'NAO_ENCONTRADO',
        mensagem: `Usuário #${id} não encontrado(a).`
      });
    }
    return usuario;
  };

  const garantirEmailLivre = (email: string | undefined, idAtual?: number): void => {
    const normalizado = email?.trim().toLowerCase();
    if (normalizado && usuarios.some((u) => u.email === normalizado && u.id !== idAtual)) {
      throw new ErroSimulado({
        codigo: 'VALIDACAO',
        mensagem: 'Dados inválidos. Confira os campos destacados.',
        campos: { email: 'Já existe um usuário com este e-mail.' }
      });
    }
  };

  return {
    listar: (filtro: FiltroUsuarioDTO = {}) => {
      const busca = filtro.busca?.toLowerCase() ?? '';
      return usuarios
        .filter((u) => !filtro.perfil || u.perfil === filtro.perfil)
        .filter((u) => filtro.ativo === undefined || u.ativo === filtro.ativo)
        .filter((u) => !busca || u.nome.toLowerCase().includes(busca) || u.email.includes(busca))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    },
    buscarPorId: ({ id }: IdDTO) => obter(id),
    criar: ({ nome, email, perfil }: CriarUsuarioDTO) => {
      garantirEmailLivre(email);
      const novo: UsuarioDTO = {
        id: proximoId++,
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        perfil,
        ativo: true,
        createdAt: '2026-11-17 09:00:00'
      };
      usuarios.push(novo);
      return novo;
    },
    atualizar: (entrada: AtualizarUsuarioDTO) => {
      // A nova senha (se vier) é descartada: aqui não existe hash para gravar.
      const { id, nome, email, perfil, ativo } = entrada;
      const dados = { nome, email, perfil, ativo };
      for (const chave of Object.keys(dados) as (keyof typeof dados)[]) {
        if (dados[chave] === undefined) delete dados[chave];
      }
      const atual = obter(id);
      garantirEmailLivre(dados.email, id);
      if (
        id === logado?.id &&
        (dados.ativo === false || (dados.perfil && dados.perfil !== 'ADMIN'))
      ) {
        throw new ErroSimulado({
          codigo: 'REGRA_NEGOCIO',
          mensagem: 'Você não pode desativar nem rebaixar o seu próprio usuário.'
        });
      }
      Object.assign(atual, dados, dados.email ? { email: dados.email.trim().toLowerCase() } : {});
      return atual;
    },
    excluir: ({ id }: IdDTO) => {
      const atual = obter(id);
      if (comReservas.has(id)) {
        throw new ErroSimulado({
          codigo: 'REGRA_NEGOCIO',
          mensagem: `Não é possível excluir ${atual.nome}: ele(a) já registrou reservas. Desative o acesso.`
        });
      }
      usuarios = usuarios.filter((u) => u.id !== id);
    }
  };
}
