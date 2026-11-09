import './styles/global.css';

class TelaInicial {
  constructor(private readonly raiz: HTMLElement) {}

  async renderizar(): Promise<void> {
    const titulo = document.createElement('h1');
    titulo.textContent = 'Aluguel de Equipamentos Esportivos';

    const status = document.createElement('p');
    status.className = 'status';
    status.textContent = 'Conectando ao processo principal...';

    this.raiz.replaceChildren(titulo, status);

    const resposta = await window.api.app.info();
    status.textContent = resposta.ok
      ? `v${resposta.dados.versao} · Electron ${resposta.dados.electron} · ${resposta.dados.plataforma}`
      : resposta.erro.mensagem;
  }
}

const raiz = document.getElementById('app');
if (raiz) void new TelaInicial(raiz).renderizar();
