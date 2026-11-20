import bcrypt from 'bcryptjs';

/**
 * Custo do bcrypt: o hash é refeito 2^10 vezes. Deixa cada tentativa lenta o
 * bastante para atrapalhar quem tenta adivinhar senhas, mas o login continua rápido.
 * É o mesmo custo dos hashes do seed.
 */
export const CUSTO_BCRYPT = 10;

/** O bcrypt só usa os primeiros 72 bytes da senha; o schema limita o tamanho antes. */
export const SENHA_MAXIMO = 72;

/**
 * Hash usado quando o e-mail não existe: o login confere a senha contra ele mesmo assim,
 * para a resposta demorar o mesmo tempo e não revelar quais e-mails têm conta.
 * (É o hash de um texto aleatório; nenhuma senha confere com ele.)
 */
const HASH_FICTICIO = '$2b$10$H7JyD.Lf7muiSNj5Ldtd7.o0z0Se7/tQo2WX9KzGN3XsSzMYlvU06';

/**
 * Transforma senhas em hash (bcrypt) e confere senhas digitadas.
 * A senha em texto puro nunca é gravada no banco nem aparece em log.
 */
export class HashSenha {
  constructor(private readonly custo = CUSTO_BCRYPT) {}

  gerar(senha: string): Promise<string> {
    return bcrypt.hash(senha, this.custo);
  }

  /** `hash` ausente (usuário não existe) = confere contra o hash fictício e devolve false. */
  async conferir(senha: string, hash: string | null | undefined): Promise<boolean> {
    if (!hash) {
      await bcrypt.compare(senha, HASH_FICTICIO);
      return false;
    }
    return bcrypt.compare(senha, hash);
  }
}
