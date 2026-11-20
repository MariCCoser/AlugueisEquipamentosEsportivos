import type { ContagemTabelaDTO, StatusBancoDTO } from '@shared/dto/banco.dto';
import { cabecalhoTela } from '../components/CabecalhoTela';
import { Consulta } from '../components/Consulta';
import { estadoErro } from '../components/Estados';
import { Tabela } from '../components/Tabela';
import { el } from '../nucleo/dom';
import type { Tela } from '../nucleo/Tela';

/**
 * Status do sistema (#/sistema): versão do app e estado do banco, com a contagem
 * de registros por tabela (o que a tela inicial da Pessoa 1 mostrava).
 * Útil para conferir a instalação; o link fica no rodapé do Painel.
 */
export class StatusSistemaTela implements Tela {
  readonly titulo = 'Status do sistema';

  montar(alvo: HTMLElement): void {
    const versao = el('p', { classe: 'cabecalho-tela__detalhe', texto: 'Consultando versão...' });
    const areaBanco = el('div');

    alvo.append(
      cabecalhoTela(this.titulo),
      el('section', { classe: 'cartao', atributos: { 'aria-labelledby': 'titulo-sistema' } }, [
        el('h2', { texto: 'Sistema', atributos: { id: 'titulo-sistema' } }),
        versao
      ]),
      el('section', { classe: 'cartao', atributos: { 'aria-labelledby': 'titulo-banco' } }, [
        el('h2', { texto: 'Banco de dados', atributos: { id: 'titulo-banco' } }),
        areaBanco
      ])
    );

    void this.mostrarVersao(versao);
    void new Consulta<StatusBancoDTO>(areaBanco, {
      buscar: () => window.api.app.statusBanco(),
      textoCarregando: 'Verificando banco de dados...',
      renderizar: (status) => this.desenharBanco(status)
    }).carregar();
  }

  private async mostrarVersao(destino: HTMLElement): Promise<void> {
    const info = await window.api.app.info();
    destino.textContent = info.ok
      ? `${info.dados.nome} v${info.dados.versao} · Electron ${info.dados.electron} · ${info.dados.plataforma}`
      : info.erro.mensagem;
  }

  private desenharBanco(status: StatusBancoDTO): Node {
    if (!status.conectado) return estadoErro(status.mensagem);

    const tabela = new Tabela<ContagemTabelaDTO & { id: number }>({
      legenda: 'Registros por tabela',
      colunas: [
        {
          titulo: 'Tabela',
          valor: (t) => t.tabela,
          ordenar: (a, b) => a.tabela.localeCompare(b.tabela)
        },
        {
          titulo: 'Registros',
          valor: (t) => t.registros,
          numerica: true,
          ordenar: (a, b) => a.registros - b.registros
        }
      ]
    });

    return el('div', {}, [
      el('p', {}, [
        el('span', { classe: 'etiqueta etiqueta--sucesso', texto: 'Conectado' }),
        ` Banco "${status.banco}"`
      ]),
      tabela.renderizar(status.tabelas.map((t, i) => ({ ...t, id: i + 1 })))
    ]);
  }
}
