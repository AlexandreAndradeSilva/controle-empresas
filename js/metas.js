/* Metas e avisos: acompanha o quanto ja foi feito de um objetivo (fechar a
   apuracao de um recorte de empresas, manter um ritmo semanal, ou uma meta
   numerica livre) e avisa quando o progresso passa do limiar ou o prazo chega. */
import { $, $$, toast, escapeHtml, fmtDate, isoDate, mesKeyAtual, ativarAnimacaoBarras, uid } from './utils.js';
import { DATA, saveData } from './state.js';
import { openModal, confirmDialog } from './modal.js';
import { regimeTemObrigacoes } from './fields.js';

function parseMetaValorAlvo(str){
  // aceita "10", "10 clientes", "R$ 5000" etc — extrai o primeiro número pra calcular %,
  // guarda o texto original pra exibir com a unidade que o usuário escreveu
  const s = (str||'').toString();
  const m = s.replace(/\./g,'').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}
function empresasAtivas(){ return DATA.companies.filter(c => !c.baixada); }
// Aplica os critérios de filtro (regime / fator R / ISSQN / sem movimento) e,
// quando faz sentido pra ação escolhida, restringe automaticamente às empresas
// às quais aquela ação se aplica (ex: MIT só existe pra Presumido/Real).
export function filtrarEmpresasParaMeta(filtro, acao){
  let list = empresasAtivas();
  filtro = filtro || {};
  if(filtro.regime) list = list.filter(c => c.regime === filtro.regime);
  if(filtro.fatorR === 'SIM') list = list.filter(c => c.fatorR === 'SIM');
  else if(filtro.fatorR === 'NAO') list = list.filter(c => c.fatorR !== 'SIM');
  if(filtro.issqn === 'QUALQUER') list = list.filter(c => c.issqnPrest === 'SIM' || c.issqnTomado === 'SIM');
  else if(filtro.issqn === 'PRESTADO') list = list.filter(c => c.issqnPrest === 'SIM');
  else if(filtro.issqn === 'TOMADO') list = list.filter(c => c.issqnTomado === 'SIM');
  if(filtro.semMovimento) list = list.filter(c => c.dificuldade === 'SEM MOVIMENTO');
  if(acao === 'mit_entregue') list = list.filter(c => regimeTemObrigacoes(c));
  if(acao === 'guia_iss_enviada') list = list.filter(c => { const d = parseInt(c.diaVencimentoIss, 10); return d >= 1 && d <= 31; });
  return list;
}
export function empresaCumpriuAcao(c, acao){
  if(acao === 'mit_entregue') return (c.obrigacoes||{}).entregaMit === 'CONCLUIDO';
  if(acao === 'guia_iss_enviada') return !!(c.issDismissedMeses||{})[mesKeyAtual()];
  return c.status === 'CONCLUIDA'; // apuracao_concluida (padrão)
}
const ACAO_LABELS = {
  apuracao_concluida: 'Fechar a apuração do mês',
  mit_entregue: 'Entregar o MIT',
  guia_iss_enviada: 'Enviar a Guia ISSQN deste mês'
};
function descreverFiltro(filtro){
  filtro = filtro || {};
  const partes = [];
  if(filtro.regime) partes.push(filtro.regime.charAt(0) + filtro.regime.slice(1).toLowerCase());
  if(filtro.fatorR === 'SIM') partes.push('Fator R');
  if(filtro.fatorR === 'NAO') partes.push('sem Fator R');
  if(filtro.issqn === 'QUALQUER') partes.push('ISSQN (Prest. ou Tomado)');
  if(filtro.issqn === 'PRESTADO') partes.push('ISSQN Prestado');
  if(filtro.issqn === 'TOMADO') partes.push('ISSQN Tomado');
  if(filtro.semMovimento) partes.push('sem movimento');
  return partes.length ? partes.join(' · ') : 'todas as empresas';
}
function getInicioSemana(d){
  const dt = new Date(d); dt.setHours(0,0,0,0);
  const diaSemana = dt.getDay(); // 0=domingo
  const diffParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
  dt.setDate(dt.getDate() + diffParaSegunda);
  return dt;
}
export function semanaKeyAtual(){
  const inicio = getInicioSemana(new Date());
  return isoDate(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
}
export function calcularProgressoMeta(m){
  if(m.tipo === 'ritmo'){
    const inicio = getInicioSemana(new Date());
    const fim = new Date(inicio); fim.setDate(fim.getDate()+6); fim.setHours(23,59,59,999);
    const list = filtrarEmpresasParaMeta(m.filtroRitmo, 'apuracao_concluida');
    const concluidas = list.filter(c => {
      if(!c.dataConcluida) return false;
      const dt = new Date(c.dataConcluida);
      return dt >= inicio && dt <= fim;
    }).length;
    const meta = parseInt(m.metaSemanal, 10) || 1;
    return Math.min(100, Math.round((concluidas / meta) * 100));
  }
  if(m.tipo === 'checklist'){
    const list = filtrarEmpresasParaMeta(m.filtro, m.acao);
    if(list.length === 0) return 100;
    const feitas = list.filter(c => empresaCumpriuAcao(c, m.acao)).length;
    return Math.round((feitas / list.length) * 100);
  }
  // livre
  const alvo = parseMetaValorAlvo(m.valorAlvoTexto);
  const atual = parseFloat(m.valorAtual) || 0;
  if(!alvo || alvo <= 0) return 0;
  return Math.min(100, Math.round((atual / alvo) * 100));
}
export function diasRestantesMeta(m){
  if(!m.prazo) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const [y,mo,d] = m.prazo.split('-').map(Number);
  const alvo = new Date(y, mo-1, d);
  return Math.round((alvo - hoje) / 86400000);
}
function descricaoMetaAlvo(m){
  if(m.tipo === 'checklist'){
    const list = filtrarEmpresasParaMeta(m.filtro, m.acao);
    const feitas = list.filter(c => empresaCumpriuAcao(c, m.acao)).length;
    return `${ACAO_LABELS[m.acao] || m.acao} · ${descreverFiltro(m.filtro)} (${feitas}/${list.length})`;
  }
  if(m.tipo === 'ritmo'){
    const inicio = getInicioSemana(new Date());
    const fim = new Date(inicio); fim.setDate(fim.getDate()+6); fim.setHours(23,59,59,999);
    const list = filtrarEmpresasParaMeta(m.filtroRitmo, 'apuracao_concluida');
    const concluidas = list.filter(c => c.dataConcluida && new Date(c.dataConcluida) >= inicio && new Date(c.dataConcluida) <= fim).length;
    return `${concluidas} de ${m.metaSemanal || 0} esta semana · ${descreverFiltro(m.filtroRitmo)}`;
  }
  return `${m.valorAtual ?? 0} de ${m.valorAlvoTexto || '—'}`;
}
function tipoMetaLabel(m){
  return { checklist: 'Meta por empresas', ritmo: 'Ritmo semanal', livre: 'Personalizada' }[m.tipo] || m.tipo;
}

let metasDispensadasNestaSessao = false;
export function renderAvisosMetas(){
  const banner = $('#bannerMetasAvisos');
  if(!banner) return;
  const avisos = [];
  let mudou = false;
  const semanaAtual = semanaKeyAtual();
  (DATA.metas||[]).forEach(m => {
    // ritmo semanal reinicia toda semana: se mudou a semana, zera os avisos e a conclusão
    if(m.tipo === 'ritmo' && m._semanaRef !== semanaAtual){
      m._semanaRef = semanaAtual;
      m.concluida = false;
      m.avisouLimiar = false;
      m.avisouPrazo = false;
      mudou = true;
    }
    if(m.concluida) return;
    const pct = calcularProgressoMeta(m);
    if(pct >= 100){
      m.concluida = true;
      mudou = true;
      toast(`🎉 Meta concluída: ${m.nome}`);
      return;
    }
    const limiar = m.avisoPct || 80;
    if(pct >= limiar && !m.avisouLimiar){
      m.avisouLimiar = true;
      mudou = true;
      avisos.push(m.avisoTexto ? m.avisoTexto : `Meta "${m.nome}" já está em ${pct}% — quase lá!`);
    }
    if(m.tipo !== 'ritmo'){
      const dias = diasRestantesMeta(m);
      if(dias !== null && dias <= 3 && dias >= 0 && !m.avisouPrazo){
        m.avisouPrazo = true;
        mudou = true;
        avisos.push(`Faltam ${dias === 0 ? 'só hoje' : dias + ' dia' + (dias===1?'':'s')} para o prazo da meta "${m.nome}" (${pct}% concluído).`);
      }
    }
  });
  if(mudou) saveData();
  const badge = $('#metasAtivasCount');
  if(badge){
    const ativas = (DATA.metas||[]).filter(m => !m.concluida).length;
    badge.style.display = ativas > 0 ? '' : 'none';
    badge.textContent = ativas;
  }
  if(avisos.length === 0 || metasDispensadasNestaSessao){ banner.style.display = 'none'; return; }
  $('#bannerMetasAvisosText').innerHTML = avisos.map(a => `<span>${escapeHtml(a)}</span>`).join('');
  banner.style.display = 'flex';
}
$('#btnVerMetasBanner').addEventListener('click', () => { openModalMetas(); });
$('#btnDispensarMetasBanner').addEventListener('click', () => {
  metasDispensadasNestaSessao = true;
  $('#bannerMetasAvisos').style.display = 'none';
});

export function openModalMetas(){
  fecharFormMeta();
  renderMetasList();
  openModal('#modalMetas');
}
$('#btnMetas').addEventListener('click', openModalMetas);

function renderMetasList(){
  const box = $('#metasList');
  const metas = DATA.metas || [];
  if(metas.length === 0){
    box.innerHTML = `<div class="empty">Nenhuma meta cadastrada ainda. Clique em "Nova meta" pra começar.</div>`;
    return;
  }
  box.innerHTML = metas.map(m => {
    const pct = calcularProgressoMeta(m);
    let prazoTxt = '';
    if(m.tipo !== 'ritmo' && m.prazo){
      const dias = diasRestantesMeta(m);
      if(dias !== null){
        if(dias < 0) prazoTxt = `<span style="color:var(--red);font-weight:700">Prazo vencido (${fmtDate(m.prazo)})</span>`;
        else if(dias === 0) prazoTxt = `<span style="color:var(--amber-dark);font-weight:700">Vence hoje</span>`;
        else prazoTxt = `Prazo: ${fmtDate(m.prazo)} (${dias} dia${dias===1?'':'s'})`;
      }
    } else if(m.tipo === 'ritmo'){
      prazoTxt = 'Reinicia toda segunda-feira';
    }
    return `
    <div class="panel" style="margin-top:0;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <strong style="font-size:.92rem">${escapeHtml(m.nome)}</strong>
            <span class="regime-tag">${tipoMetaLabel(m)}</span>
            ${m.concluida ? '<span class="regime-tag" style="color:var(--green);border-color:var(--green)">Concluída</span>' : ''}
          </div>
          <div class="small-muted" style="margin-top:4px">${escapeHtml(descricaoMetaAlvo(m))}${prazoTxt ? ' · ' + prazoTxt : ''}</div>
        </div>
        <div style="display:flex;gap:6px;flex:none">
          <button class="btn btn-outline btn-sm" data-editarmeta="${m.id}">Editar</button>
          <button class="btn btn-danger btn-sm" data-excluirmeta="${m.id}">Excluir</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:10px">
        <div style="flex:1;height:9px;background:var(--line);border-radius:5px;overflow:hidden">
          <span class="progress-fill" style="display:block;height:100%;width:${pct}%" data-bar-target="${pct}%"></span>
        </div>
        <span style="font-size:.8rem;font-weight:800;color:${pct>=100?'var(--green)':'var(--ink)'};min-width:38px;text-align:right">${pct}%</span>
      </div>
    </div>`;
  }).join('');
  ativarAnimacaoBarras(box);
  box.querySelectorAll('[data-editarmeta]').forEach(btn => {
    btn.addEventListener('click', () => abrirFormMeta(btn.dataset.editarmeta));
  });
  box.querySelectorAll('[data-excluirmeta]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if(!(await confirmDialog('Excluir esta meta?', {okLabel:'Excluir'}))) return;
      DATA.metas = (DATA.metas||[]).filter(m => m.id !== btn.dataset.excluirmeta);
      await saveData();
      renderMetasList();
      renderAvisosMetas();
    });
  });
}

function toggleMetaFormCampos(){
  const tipo = $('#metaFormTipo').value;
  $('#metaFormChecklistBlock').style.display = tipo === 'checklist' ? '' : 'none';
  $('#metaFormRitmoBlock').style.display = tipo === 'ritmo' ? '' : 'none';
  $('#metaFormLivreRow').style.display = tipo === 'livre' ? '' : 'none';
  $('#metaFormPrazoLivreWrap').style.display = tipo === 'livre' ? '' : 'none';
}
$('#metaFormTipo').addEventListener('change', toggleMetaFormCampos);

function fecharFormMeta(){
  $('#metaFormCard').style.display = 'none';
}
$('#btnCancelarMeta').addEventListener('click', fecharFormMeta);

function abrirFormMeta(id){
  const m = id ? (DATA.metas||[]).find(x => x.id === id) : null;
  $('#metaFormId').value = m ? m.id : '';
  $('#metaFormTitulo').textContent = m ? 'Editar meta' : 'Nova meta';
  $('#metaFormTipo').value = m ? m.tipo : 'checklist';
  $('#metaFormNome').value = m ? m.nome : '';

  const filtro = (m && m.filtro) || {};
  $('#metaFiltroRegime').value = filtro.regime || '';
  $('#metaFiltroFatorR').value = filtro.fatorR || '';
  $('#metaFiltroIssqn').value = filtro.issqn || '';
  $('#metaFiltroSemMovimento').checked = !!filtro.semMovimento;
  $('#metaFormAcao').value = (m && m.acao) || 'apuracao_concluida';
  $('#metaFormPrazoChecklist').value = (m && m.tipo === 'checklist') ? (m.prazo || '') : '';

  $('#metaFormRitmoQtd').value = (m && m.metaSemanal) || '';
  const filtroRitmo = (m && m.filtroRitmo) || {};
  $('#metaRitmoFiltroRegime').value = filtroRitmo.regime || '';
  $('#metaRitmoFiltroFatorR').value = filtroRitmo.fatorR || '';
  $('#metaRitmoFiltroIssqn').value = filtroRitmo.issqn || '';
  $('#metaRitmoFiltroSemMovimento').checked = !!filtroRitmo.semMovimento;

  $('#metaFormValorAtual').value = m ? (m.valorAtual ?? '') : '';
  $('#metaFormValorAlvo').value = m ? (m.valorAlvoTexto || '') : '';
  $('#metaFormPrazo').value = (m && m.tipo === 'livre') ? (m.prazo || '') : '';

  $('#metaFormAvisoPct').value = m ? (m.avisoPct || 80) : 80;
  $('#metaFormAvisoTexto').value = m ? (m.avisoTexto || '') : '';
  toggleMetaFormCampos();
  $('#metaFormCard').style.display = '';
}
$('#btnNovaMeta').addEventListener('click', () => abrirFormMeta(null));

$('#btnSalvarMeta').addEventListener('click', async () => {
  const nome = $('#metaFormNome').value.trim();
  if(!nome){ toast('Dê um nome pra meta.'); return; }
  const id = $('#metaFormId').value;
  const tipo = $('#metaFormTipo').value;
  const avisoPct = Math.min(100, Math.max(1, parseInt($('#metaFormAvisoPct').value, 10) || 80));
  let m = id ? (DATA.metas||[]).find(x => x.id === id) : null;

  if(tipo === 'ritmo'){
    const qtd = parseInt($('#metaFormRitmoQtd').value, 10);
    if(!qtd || qtd <= 0){ toast('Informe quantas empresas por semana.'); return; }
  }

  const nova = {
    id: m ? m.id : uid('meta'),
    tipo,
    nome,
    // checklist
    filtro: tipo === 'checklist' ? {
      regime: $('#metaFiltroRegime').value,
      fatorR: $('#metaFiltroFatorR').value,
      issqn: $('#metaFiltroIssqn').value,
      semMovimento: $('#metaFiltroSemMovimento').checked
    } : undefined,
    acao: tipo === 'checklist' ? $('#metaFormAcao').value : undefined,
    // ritmo
    metaSemanal: tipo === 'ritmo' ? (parseInt($('#metaFormRitmoQtd').value, 10) || 1) : undefined,
    filtroRitmo: tipo === 'ritmo' ? {
      regime: $('#metaRitmoFiltroRegime').value,
      fatorR: $('#metaRitmoFiltroFatorR').value,
      issqn: $('#metaRitmoFiltroIssqn').value,
      semMovimento: $('#metaRitmoFiltroSemMovimento').checked
    } : undefined,
    _semanaRef: tipo === 'ritmo' ? (m && m._semanaRef ? m._semanaRef : semanaKeyAtual()) : undefined,
    // livre
    valorAtual: tipo === 'livre' ? (parseFloat($('#metaFormValorAtual').value) || 0) : undefined,
    valorAlvoTexto: tipo === 'livre' ? $('#metaFormValorAlvo').value.trim() : undefined,
    // prazo: checklist usa campo próprio, livre usa o seu
    prazo: tipo === 'checklist' ? ($('#metaFormPrazoChecklist').value || '') : (tipo === 'livre' ? ($('#metaFormPrazo').value || '') : ''),
    avisoPct,
    avisoTexto: $('#metaFormAvisoTexto').value.trim(),
    concluida: m ? m.concluida : false,
    avisouLimiar: m ? m.avisouLimiar : false,
    avisouPrazo: m ? m.avisouPrazo : false
  };
  if(!m){ DATA.metas = DATA.metas || []; DATA.metas.push(nova); }
  else { Object.assign(m, nova); }
  await saveData();
  fecharFormMeta();
  renderMetasList();
  renderAvisosMetas();
  toast('Meta salva.');
});
