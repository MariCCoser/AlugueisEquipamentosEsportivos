import type {
  Categoria,
  Cliente,
  Equipamento,
  Fornecedor,
  Usuario
} from '@shared/models/entidades';

/** Registros de exemplo (parecidos com o seed) para montar cenários nos testes. */
const datas = { createdAt: '2026-11-01 10:00:00', updatedAt: '2026-11-01 10:00:00' };

export function umCliente(extra: Partial<Cliente> = {}): Cliente {
  return {
    id: 1,
    nome: 'Ana Souza',
    cpf: '52998224725',
    telefone: '11987654321',
    email: 'ana.souza@email.com',
    cep: '01310100',
    rua: 'Avenida Paulista',
    numero: '1000',
    complemento: null,
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
    ...datas,
    ...extra
  };
}

export function umEquipamento(extra: Partial<Equipamento> = {}): Equipamento {
  return {
    id: 1,
    nome: 'Mountain Bike Aro 29',
    descricao: null,
    modalidade: 'LOCACAO',
    estadoConservacao: 'MUITO_BOM',
    status: 'DISPONIVEL',
    valorDiaria: 45,
    precoVenda: null,
    dataAquisicao: null,
    categoriaId: 1,
    fornecedorId: 1,
    ...datas,
    ...extra
  };
}

export function umaCategoria(extra: Partial<Categoria> = {}): Categoria {
  return {
    id: 1,
    nome: 'Bicicletas',
    descricao: null,
    sensivelClima: true,
    ...datas,
    ...extra
  };
}

export function umFornecedor(extra: Partial<Fornecedor> = {}): Fornecedor {
  return {
    id: 1,
    razaoSocial: 'Esporte Total Distribuidora Ltda',
    cnpj: '11222333000181',
    tipo: 'COMPRA',
    contato: null,
    telefone: null,
    email: null,
    ...datas,
    ...extra
  };
}

/** Usuário de exemplo. O `senhaHash` padrão é de 'senha-que-ninguem-usa'. */
export function umUsuario(extra: Partial<Usuario> = {}): Usuario {
  return {
    id: 1,
    nome: 'Administrador',
    email: 'admin@aluguel.local',
    senhaHash: '$2b$04$wFs2yTaAmTFxHVYpYKsa9OtHMJB1dVSh8hKnRrDVpLt1YdCUiy5rC',
    perfil: 'ADMIN',
    ativo: true,
    ultimoLogin: null,
    ...datas,
    ...extra
  };
}

/** Simula o erro que o mysql2 lança (só o `code` importa para o tradutor). */
export function erroMysql(code: string): Error {
  return Object.assign(new Error(`erro ${code} do mysql`), { code });
}
