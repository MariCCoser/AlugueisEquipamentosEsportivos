import { describe, expect, it } from 'vitest';
import { LimiteTentativas } from '../../../src/main/security/LimiteTentativas';

function montar() {
  const relogio = { agora: 1_000_000 };
  const limite = new LimiteTentativas(3, 5 * 60_000, () => relogio.agora);
  return { relogio, limite };
}

describe('LimiteTentativas', () => {
  it('libera enquanto não chegar no máximo de erros', () => {
    const { limite } = montar();
    limite.registrarErro('ana@loja.com');
    limite.registrarErro('ana@loja.com');
    expect(limite.minutosBloqueado('ana@loja.com')).toBe(0);
  });

  it('bloqueia ao chegar no máximo e informa os minutos que faltam', () => {
    const { limite, relogio } = montar();
    for (let i = 0; i < 3; i++) limite.registrarErro('ana@loja.com');
    expect(limite.minutosBloqueado('ana@loja.com')).toBe(5);

    relogio.agora += 2 * 60_000 + 1;
    expect(limite.minutosBloqueado('ana@loja.com')).toBe(3);
  });

  it('libera sozinho quando o tempo de bloqueio passa e recomeça a contagem', () => {
    const { limite, relogio } = montar();
    for (let i = 0; i < 3; i++) limite.registrarErro('ana@loja.com');
    relogio.agora += 5 * 60_000;
    expect(limite.minutosBloqueado('ana@loja.com')).toBe(0);

    limite.registrarErro('ana@loja.com'); // 1º erro da nova contagem
    expect(limite.minutosBloqueado('ana@loja.com')).toBe(0);
  });

  it('um acerto zera os erros', () => {
    const { limite } = montar();
    limite.registrarErro('ana@loja.com');
    limite.registrarErro('ana@loja.com');
    limite.registrarAcerto('ana@loja.com');
    limite.registrarErro('ana@loja.com');
    limite.registrarErro('ana@loja.com');
    expect(limite.minutosBloqueado('ana@loja.com')).toBe(0);
  });

  it('trata o e-mail sem diferenciar maiúsculas e espaços', () => {
    const { limite } = montar();
    limite.registrarErro('Ana@Loja.com');
    limite.registrarErro(' ana@loja.com ');
    limite.registrarErro('ANA@LOJA.COM');
    expect(limite.minutosBloqueado('ana@loja.com')).toBe(5);
  });

  it('o bloqueio de um e-mail não afeta outro', () => {
    const { limite } = montar();
    for (let i = 0; i < 3; i++) limite.registrarErro('ana@loja.com');
    expect(limite.minutosBloqueado('bruno@loja.com')).toBe(0);
  });
});
