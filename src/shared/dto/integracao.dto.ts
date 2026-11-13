import type { DataISO } from './resposta';

// ---------- API 1: CEP (ViaCEP) ----------

export interface BuscarCepDTO {
  /** Só os 8 dígitos. */
  cep: string;
}

/** Endereço que o ViaCEP devolve, para preencher o cadastro do cliente. */
export interface EnderecoDTO {
  cep: string;
  rua: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
}

// ---------- API 2: previsão do tempo ----------

export interface PrevisaoClimaEntradaDTO {
  cidade: string;
  uf: string;
  /** Dia da retirada. */
  data: DataISO;
  /** Equipamentos da reserva, para saber se algum é sensível ao clima. */
  equipamentoIds: number[];
}

export interface PrevisaoClimaDTO {
  cidade: string;
  data: DataISO;
  temperaturaMinima: number;
  temperaturaMaxima: number;
  /** De 0 a 100. */
  chanceDeChuva: number;
  /** Ex.: "Chuva forte", "Céu limpo". */
  descricao: string;
  /** true = mostrar o aviso na confirmação da reserva. */
  alerta: boolean;
  mensagemAlerta?: string;
  /** Categorias da reserva que são sensíveis ao clima (ex.: "Caiaques e Canoas"). */
  categoriasSensiveis: string[];
}

// ---------- API 3: rotas e mapas ----------

export interface CalcularRotaDTO {
  clienteId: number;
}

/** Caminho da loja até o cliente (para buscar equipamento atrasado). */
export interface RotaDTO {
  distanciaKm: number;
  duracaoMinutos: number;
  enderecoDestino: string;
  /** Link para abrir o mapa no navegador. */
  linkMapa: string;
}
