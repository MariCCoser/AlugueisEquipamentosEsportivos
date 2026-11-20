import type { ManutencaoDTO } from '@shared/dto/manutencao.dto';
import type { EstadoConservacao, TipoManutencao } from '@shared/models/enums';
import { aplicarErros, CampoAreaTexto, CampoSelect, CampoTexto } from '../../components/Campos';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { botao, el, novoId } from '../../nucleo/dom';
import { hojeISO } from '../../util/datas';
import { lerDinheiro } from '../../util/dinheiro';
import { formatarData } from '../../util/formatadores';
import { ROTULOS_ESTADO_CONSERVACAO, ROTULOS_TIPO_MANUTENCAO, opcoesDe } from '../../util/rotulos';

/** Monta o modal com o formulário e o botão de enviar ligados. */
function modalComFormulario(
  titulo: string,
  textoBotao: string,
  campos: HTMLElement[],
  enviar: (salvar: HTMLButtonElement, modal: Modal) => Promise<void>
): Modal {
  const idFormulario = novoId('form-manutencao');
  const salvar = el('button', {
    classe: 'botao botao--primario',
    texto: textoBotao,
    atributos: { type: 'submit', form: idFormulario }
  });
  const formulario = el('form', { atributos: { id: idFormulario, novalidate: true } }, campos);
  const modal: Modal = new Modal({
    titulo,
    conteudo: [formulario],
    rodape: [botao('Cancelar', () => modal.fechar()), salvar]
  });
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    void enviar(salvar, modal);
  });
  return modal;
}

/**
 * Envio de um equipamento DISPONÍVEL para o conserto (ele passa a EM_MANUTENCAO).
 * Só aparecem fornecedores do tipo Manutenção.
 */
export async function abrirEnvioManutencao(aoSalvar: () => void): Promise<void> {
  const [equipamentos, fornecedores] = await Promise.all([
    window.api.equipamentos.listar({ status: 'DISPONIVEL', porPagina: 100 }),
    window.api.fornecedores.listarPorTipo({ tipo: 'MANUTENCAO' })
  ]);
  if (!equipamentos.ok) return Toast.erro(equipamentos.erro.mensagem);
  if (!fornecedores.ok) return Toast.erro(fornecedores.erro.mensagem);
  if (fornecedores.dados.length === 0) {
    return Toast.erro('Cadastre um fornecedor do tipo Manutenção antes de enviar equipamentos.');
  }

  const equipamento = new CampoSelect({
    nome: 'equipamentoId',
    rotulo: 'Equipamento',
    opcoes: equipamentos.dados.itens.map((e) => ({
      valor: String(e.id),
      rotulo: `${e.nome} (${e.categoriaNome})`
    })),
    opcaoVazia: 'Escolha o equipamento',
    obrigatorio: true,
    ajuda: 'Só aparecem equipamentos disponíveis (não reservados).'
  });
  const fornecedor = new CampoSelect({
    nome: 'fornecedorId',
    rotulo: 'Oficina (fornecedor)',
    opcoes: fornecedores.dados.map((f) => ({ valor: String(f.id), rotulo: f.razaoSocial })),
    opcaoVazia: 'Escolha a oficina',
    obrigatorio: true
  });
  const tipo = new CampoSelect({
    nome: 'tipo',
    rotulo: 'Tipo',
    opcoes: opcoesDe(ROTULOS_TIPO_MANUTENCAO),
    valor: 'CORRETIVA'
  });
  const dataEnvio = new CampoTexto({
    nome: 'dataEnvio',
    rotulo: 'Data de envio',
    tipo: 'date',
    valor: hojeISO(),
    obrigatorio: true
  });
  dataEnvio.controle.max = hojeISO();
  const descricao = new CampoAreaTexto({
    nome: 'descricao',
    rotulo: 'O que precisa ser feito',
    maximo: 255,
    ajuda: 'Ex.: troca do câmbio, remendo no casco.'
  });
  const campos = [equipamento, fornecedor, tipo, dataEnvio, descricao];

  const modal = modalComFormulario(
    'Enviar para manutenção',
    'Enviar',
    [
      equipamento.elemento,
      fornecedor.elemento,
      el('div', { classe: 'grade-2' }, [tipo.elemento, dataEnvio.elemento]),
      descricao.elemento
    ],
    async (salvar, janela) => {
      const erros: Record<string, string> = {};
      if (!equipamento.valor) erros['equipamentoId'] = 'Escolha o equipamento.';
      if (!fornecedor.valor) erros['fornecedorId'] = 'Escolha a oficina.';
      if (!dataEnvio.valor) erros['dataEnvio'] = 'Informe a data de envio.';
      else if (dataEnvio.valor > hojeISO()) erros['dataEnvio'] = 'A data não pode ser no futuro.';
      if (!descricao.valor.trim()) erros['descricao'] = 'Descreva o serviço.';
      if (aplicarErros(campos, erros)) return;

      salvar.disabled = true;
      const resposta = await window.api.manutencoes
        .criar({
          equipamentoId: Number(equipamento.valor),
          fornecedorId: Number(fornecedor.valor),
          tipo: tipo.valor as TipoManutencao,
          dataEnvio: dataEnvio.valor,
          descricao: descricao.valor.trim()
        })
        .catch(() => null);
      salvar.disabled = false;
      if (!resposta) return Toast.erro('Não foi possível se comunicar com o sistema.');
      if (resposta.ok) {
        Toast.sucesso(`${resposta.dados.equipamentoNome} enviado para manutenção.`);
        janela.fechar();
        aoSalvar();
      } else if (!aplicarErros(campos, resposta.erro.campos)) {
        Toast.erro(resposta.erro.mensagem);
      }
    }
  );
  modal.abrir();
  equipamento.focar();
}

/** Volta do conserto: o equipamento fica DISPONÍVEL com o estado em que voltou. */
export function abrirRetornoManutencao(m: ManutencaoDTO, aoSalvar: () => void): void {
  const dataRetorno = new CampoTexto({
    nome: 'dataRetorno',
    rotulo: 'Data de retorno',
    tipo: 'date',
    valor: hojeISO(),
    obrigatorio: true,
    ajuda: `Enviado em ${formatarData(m.dataEnvio)}.`
  });
  dataRetorno.controle.max = hojeISO();
  dataRetorno.controle.min = m.dataEnvio;
  const custo = new CampoTexto({
    nome: 'custo',
    rotulo: 'Custo do serviço (R$, opcional)',
    tipo: 'number'
  });
  custo.controle.min = '0';
  custo.controle.step = '0.01';
  const estado = new CampoSelect({
    nome: 'estadoRetorno',
    rotulo: 'Estado em que voltou',
    opcoes: opcoesDe(ROTULOS_ESTADO_CONSERVACAO),
    valor: 'MUITO_BOM'
  });
  const campos = [dataRetorno, custo, estado];

  const modal = modalComFormulario(
    `Retorno de ${m.equipamentoNome}`,
    'Registrar retorno',
    [
      el('p', { classe: 'texto-suave', texto: `${m.fornecedorNome} · ${m.descricao}` }),
      el('div', { classe: 'grade-2' }, [dataRetorno.elemento, custo.elemento]),
      estado.elemento
    ],
    async (salvar, janela) => {
      const erros: Record<string, string> = {};
      if (!dataRetorno.valor) erros['dataRetorno'] = 'Informe a data de retorno.';
      else if (dataRetorno.valor > hojeISO())
        erros['dataRetorno'] = 'A data não pode ser no futuro.';
      else if (dataRetorno.valor < m.dataEnvio) {
        erros['dataRetorno'] = 'O retorno não pode ser antes do envio.';
      }
      const valorCusto = custo.valor.trim() ? lerDinheiro(custo.valor) : null;
      if (valorCusto && valorCusto.erro !== undefined) erros['custo'] = valorCusto.erro;
      if (aplicarErros(campos, erros)) return;

      salvar.disabled = true;
      const resposta = await window.api.manutencoes
        .registrarRetorno({
          id: m.id,
          dataRetorno: dataRetorno.valor,
          estadoRetorno: estado.valor as EstadoConservacao,
          ...(valorCusto?.valor !== undefined ? { custo: valorCusto.valor } : {})
        })
        .catch(() => null);
      salvar.disabled = false;
      if (!resposta) return Toast.erro('Não foi possível se comunicar com o sistema.');
      if (resposta.ok) {
        Toast.sucesso(`${m.equipamentoNome} voltou e está disponível.`);
        janela.fechar();
        aoSalvar();
      } else if (!aplicarErros(campos, resposta.erro.campos)) {
        Toast.erro(resposta.erro.mensagem);
      }
    }
  );
  modal.abrir();
  dataRetorno.focar();
}
