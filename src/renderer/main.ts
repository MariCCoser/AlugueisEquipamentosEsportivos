import './styles/global.css';
import type { StatusBancoDTO } from '@shared/dto/banco.dto';

class TelaInicial {
  constructor(private readonly raiz: HTMLElement) {}

  async renderizar(): Promise<void> {
    const titulo = document.createElement('h1');
    titulo.textContent = 'Aluguel de Equipamentos Esportivos';

    const status = document.createElement('p');
    status.className = 'status';
    status.textContent = 'Conectando ao processo principal...';

    const banco = document.createElement('section');
    banco.className = 'banco';
    banco.textContent = 'Verificando banco de dados...';

    this.raiz.replaceChildren(titulo, status, banco);

    const info = await window.api.app.info();
    status.textContent = info.ok
      ? `v${info.dados.versao} · Electron ${info.dados.electron} · ${info.dados.plataforma}`
      : info.erro.mensagem;

    const statusBanco = await window.api.app.statusBanco();
    banco.replaceChildren(
      statusBanco.ok
        ? this.criarPainelBanco(statusBanco.dados)
        : this.criarErro(statusBanco.erro.mensagem)
    );
  }

  private criarPainelBanco(status: StatusBancoDTO): HTMLElement {
    if (!status.conectado) return this.criarErro(status.mensagem);

    const painel = document.createElement('div');
    const subtitulo = document.createElement('h2');
    subtitulo.className = 'banco-ok';
    subtitulo.textContent = `✔ Banco "${status.banco}" conectado`;

    const tabela = document.createElement('table');
    const cabecalho = tabela.createTHead().insertRow();
    for (const texto of ['Tabela', 'Registros']) {
      const th = document.createElement('th');
      th.textContent = texto;
      cabecalho.appendChild(th);
    }
    const corpo = tabela.createTBody();
    for (const { tabela: nome, registros } of status.tabelas) {
      const linha = corpo.insertRow();
      linha.insertCell().textContent = nome;
      linha.insertCell().textContent = String(registros);
    }

    painel.append(subtitulo, tabela);
    return painel;
  }

  private criarErro(mensagem: string): HTMLElement {
    const erro = document.createElement('p');
    erro.className = 'banco-erro';
    erro.textContent = `✖ ${mensagem}`;
    return erro;
  }
}

const raiz = document.getElementById('app');
if (raiz) void new TelaInicial(raiz).renderizar();
