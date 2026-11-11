import type { AppInfoDTO } from './dto/app.dto';
import type { StatusBancoDTO } from './dto/banco.dto';
import type { Resposta } from './dto/resposta';

/**
 * Contrato da API que o preload expõe em `window.api`.
 * O Renderer só conversa com o Main por aqui.
 */
export interface ApiExposta {
  app: {
    info(): Promise<Resposta<AppInfoDTO>>;
    statusBanco(): Promise<Resposta<StatusBancoDTO>>;
  };
}
