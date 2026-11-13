import type { ClienteDTO, CriarClienteDTO } from '@shared/dto/cliente.dto';
import type { Cliente, NovoCliente } from '@shared/models/entidades';

/** Converte entre o registro do banco (`Cliente`) e o que trafega no IPC (`ClienteDTO`). */
export class ClienteMapper {
  static paraDTO(cliente: Cliente): ClienteDTO {
    const dto: ClienteDTO = {
      id: cliente.id,
      nome: cliente.nome,
      cpf: cliente.cpf,
      cpfMascarado: ClienteMapper.mascararCpf(cliente.cpf),
      telefone: cliente.telefone,
      cep: cliente.cep,
      rua: cliente.rua,
      numero: cliente.numero,
      bairro: cliente.bairro,
      cidade: cliente.cidade,
      uf: cliente.uf,
      createdAt: cliente.createdAt,
      updatedAt: cliente.updatedAt
    };
    if (cliente.email) dto.email = cliente.email;
    if (cliente.complemento) dto.complemento = cliente.complemento;
    return dto;
  }

  /**
   * Padroniza o que veio da tela antes de gravar: CPF, CEP e telefone só com
   * dígitos, UF em maiúsculas, espaços das pontas removidos e opcionais vazios = NULL.
   */
  static paraNovo(dados: CriarClienteDTO): NovoCliente {
    return {
      nome: dados.nome.trim(),
      cpf: ClienteMapper.digitos(dados.cpf),
      telefone: ClienteMapper.digitos(dados.telefone),
      email: ClienteMapper.opcional(dados.email),
      cep: ClienteMapper.digitos(dados.cep),
      rua: dados.rua.trim(),
      numero: dados.numero.trim(),
      complemento: ClienteMapper.opcional(dados.complemento),
      bairro: dados.bairro.trim(),
      cidade: dados.cidade.trim(),
      uf: dados.uf.trim().toUpperCase()
    };
  }

  /** Versão parcial de `paraNovo`, para edição: só converte os campos que vieram. */
  static paraAtualizacao(dados: Partial<CriarClienteDTO>): Partial<NovoCliente> {
    const completo = { ...ClienteMapper.VAZIO, ...dados };
    const convertido = ClienteMapper.paraNovo(completo);
    const resultado: Partial<NovoCliente> = {};
    for (const campo of Object.keys(dados) as (keyof CriarClienteDTO)[]) {
      if (dados[campo] !== undefined) {
        (resultado as Record<string, unknown>)[campo] = convertido[campo];
      }
    }
    return resultado;
  }

  /** LGPD: a tela mostra só o miolo do CPF, ex.: 52998224725 -> ***.982.247-** */
  static mascararCpf(cpf: string): string {
    const d = ClienteMapper.digitos(cpf);
    if (d.length !== 11) return '***.***.***-**';
    return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  }

  static digitos(texto: string): string {
    return texto.replace(/\D/g, '');
  }

  private static opcional(texto: string | undefined): string | null {
    const limpo = texto?.trim();
    return limpo ? limpo : null;
  }

  private static readonly VAZIO: CriarClienteDTO = {
    nome: '',
    cpf: '',
    telefone: '',
    cep: '',
    rua: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: ''
  };
}
