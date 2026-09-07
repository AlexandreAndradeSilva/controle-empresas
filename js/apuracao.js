import { $, $$, debounce, toast, escapeHtml, initials, fmtDate, formatTempo, ativarAnimacaoBarras } from './utils.js';
import { DATA, saveData, setPerfilReturnTo } from './state.js';
import { openModal, closeModal } from './modal.js';
import { docsProgressPercent } from './fields.js';
import { openPerfil, tempoApuracaoEfetivo } from './perfil.js';

let apurFilter = 'PENDENTE';

export function renderApuracao(){
  const list = DATA.companies.filter(c => !c.baixada);
  $('#aGeral').textContent = list.length;
  $('#aPendente').textContent = list.filter(c=>c.status==='PENDENTE').length;
  $('#aAndamento').textContent = list.filter(c=>c.status==='ANDAMENTO').length;
  $('#aConcluida').textContent = list.filter(c=>c.status==='CONCLUIDA').length;
  renderApurList();
}

export function renderApurList(){
  const q = $('#apurSearch').value.trim().toLowerCase();
  let list = DATA.companies.filter(c => !c.baixada);

  if(q){
    list = list.filter(c =>
      c.razaoSocial.toLowerCase().includes(q) ||
      (c.cnpj||'').includes(q) ||
      (c.responsaveis||'').toLowerCase().includes(q) ||
      (c.municipio||'').toLowerCase().includes(q) ||
      (c.numero||'').toLowerCase().includes(q)
    );
  }
  if(apurFilter !== 'GERAL'){
    list = list.filter(c => c.status === apurFilter);
  }
  const dificFilter = $('#apurDificuldadeFilter').value;
  if(dificFilter){
    list = list.filter(c => c.dificuldade === dificFilter);
  }
  const regimeFilter = $('#apurRegimeFilter').value;
  if(regimeFilter){
    list = list.filter(c => c.regime === regimeFilter);
  }
  const issqnFilter = $('#apurIssqnFilter').value;
  if(issqnFilter === 'PRESTADO'){
    list = list.filter(c => c.issqnPrest === 'SIM');
  } else if(issqnFilter === 'TOMADO'){
    list = list.filter(c => c.issqnTomado === 'SIM');
  } else if(issqnFilter === 'QUALQUER'){
    list = list.filter(c => c.issqnPrest === 'SIM' && c.issqnTomado === 'SIM');
  }
  const fatorRFilter = $('#apurFatorRFilter').value;
  if(fatorRFilter === 'SIM'){
    list = list.filter(c => c.fatorR === 'SIM');
  } else if(fatorRFilter === 'NAO'){
    list = list.filter(c => c.fatorR !== 'SIM');
  }

  const ordenarPor = $('#apurOrdenarPor').value;
  $('#apurOrdenarPor').style.display = (apurFilter === 'GERAL') ? '' : 'none';
  $('#apurDragHint').style.display = (ordenarPor === 'manual') ? 'block' : 'none';
  const semVenc = '9999-99-99';
  function manualIdx(id){
    const arr = DATA.ordemApuracaoManual || [];
    const idx = arr.indexOf(id);
    return idx === -1 ? Infinity : idx;
  }
  const PRIORITY_RANK = { 'A+':1, 'A':2, 'B+':3, 'B':4, 'C+':5, 'C':6, 'D':7 };
  function priorityRankOf(c){ return PRIORITY_RANK[c.prioridadeApuracao] || 99; }
  function priorityClassOf(v){
    return { 'A+':'p-Aplus', 'A':'p-A', 'B+':'p-Bplus', 'B':'p-B', 'C+':'p-Cplus', 'C':'p-C', 'D':'p-D' }[v] || 'p-none';
  }
  const PRIORITY_OPTIONS = ['', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D'];

  // pré-calcula o progresso uma vez só por empresa (evita recalcular a cada comparação do sort)
  let pctCache = null;
  if(ordenarPor === 'progresso_menor' || ordenarPor === 'progresso_maior'){
    pctCache = new Map();
    list.forEach(c => pctCache.set(c.id, docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao, c.regime, c.obrigacoes, c.fatorR, c.fatorRStatus)));
  }

  list = list.slice().sort((a,b) => {
    const pr = priorityRankOf(a) - priorityRankOf(b);
    if(pr !== 0) return pr;
    switch(ordenarPor){
      case 'manual': {
        const d = manualIdx(a.id) - manualIdx(b.id);
        return d !== 0 ? d : a.razaoSocial.localeCompare(b.razaoSocial);
      }
      case 'nome_za': return b.razaoSocial.localeCompare(a.razaoSocial);
      case 'venc_prox': return (a.vencimento||semVenc).localeCompare(b.vencimento||semVenc);
      case 'venc_dist': return (b.vencimento||'').localeCompare(a.vencimento||'');
      case 'progresso_menor': return pctCache.get(a.id) - pctCache.get(b.id);
      case 'progresso_maior': return pctCache.get(b.id) - pctCache.get(a.id);
      default: return a.razaoSocial.localeCompare(b.razaoSocial);
    }
  });

  $('#apurCount').textContent = list.length + (list.length===1 ? ' empresa encontrada' : ' empresas encontradas');
  const box = $('#apurList');

  if(list.length === 0){
    box.innerHTML = `<div class="empty">Nenhuma empresa encontrada.</div>`;
    return;
  }

  box.innerHTML = list.map(c => {
  const pctRow = docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao, c.regime, c.obrigacoes, c.fatorR, c.fatorRStatus);
  return `
    <div class="client-row" data-id="${c.id}" ${ordenarPor==='manual' ? 'draggable="true"' : ''} style="${ordenarPor==='manual' ? 'cursor:grab' : ''}">
      <div class="client-main">
        ${ordenarPor==='manual' ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="currentColor" class="icon-svg" style="color:var(--muted);flex:none;margin-right:2px"><circle cx="8" cy="6" r="1.6"/><circle cx="8" cy="12" r="1.6"/><circle cx="8" cy="18" r="1.6"/><circle cx="16" cy="6" r="1.6"/><circle cx="16" cy="12" r="1.6"/><circle cx="16" cy="18" r="1.6"/></svg>` : ''}
        <select class="priority-select ${priorityClassOf(c.prioridadeApuracao)}" data-priorityselect="${c.id}" title="Classificar prioridade — quanto mais alta, mais no topo da lista">
          ${PRIORITY_OPTIONS.map(v => `<option value="${v}" ${(c.prioridadeApuracao||'')===v?'selected':''}>${v||'–'}</option>`).join('')}
        </select>
        <div class="avatar">${initials(c.razaoSocial)||'?'}</div>
        <div style="min-width:0">
          <div class="client-name">${escapeHtml(c.razaoSocial)}</div>
          <div class="client-meta">${c.numero?('Nº '+c.numero+' · '):''}${c.atividade?(escapeHtml(c.atividade)+' · '):''}${c.issqnPrest==='SIM'?'<span class="meta-badge meta-badge-blue">ISSQN Prest.</span>':''}${c.issqnTomado==='SIM'?'<span class="meta-badge meta-badge-blue">ISSQN Tomado</span>':''}${c.fatorR==='SIM'?'<span class="meta-badge meta-badge-orange">Fator R</span>':''}${c.municipio||''}${c.uf?'/'+c.uf:''} ${c.vencimento ? '· vence '+fmtDate(c.vencimento) : ''}${apurFilter==='GERAL' ? ` · tempo: ${formatTempo(tempoApuracaoEfetivo(c))}` : ''}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex:none">
        <span style="display:inline-flex;align-items:center;gap:5px">
          <span style="display:inline-block;width:60px;height:7px;background:var(--line);border-radius:4px;overflow:hidden">
            <span class="progress-fill" style="display:block;height:100%;width:${pctRow}%" data-bar-target="${pctRow}%"></span>
          </span>
          <span class="small-muted" style="font-size:.7rem">${pctRow}%</span>
        </span>
        ${apurFilter === 'CONCLUIDA' ? `<button class="btn btn-outline btn-sm" data-verapuracao="${c.id}">Ver Apuração</button>`
          : apurFilter !== 'GERAL' ? `<button class="btn btn-outline btn-sm" data-iniciar="${c.id}">Iniciar</button>` : ''}
      </div>
    </div>`;
  }).join('');
  ativarAnimacaoBarras($('#apurList'));

  $$('#apurList [data-priorityselect]').forEach(sel => {
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('change', async (e) => {
      e.stopPropagation();
      const c = DATA.companies.find(x => x.id === sel.dataset.priorityselect);
      if(!c) return;
      c.prioridadeApuracao = sel.value || '';
      sel.className = 'priority-select ' + priorityClassOf(c.prioridadeApuracao);
      await saveData();
      renderApurList();
      toast(c.prioridadeApuracao ? `Prioridade definida como ${c.prioridadeApuracao}.` : 'Prioridade removida.');
    });
  });

  $$('#apurList [data-iniciar]').forEach(btn => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const c = DATA.companies.find(x => x.id === btn.dataset.iniciar);
    if(c && !c.tempoApuracaoRodando){
      c.tempoApuracaoRodando = true;
      c.tempoApuracaoInicio = new Date().toISOString();
      await saveData();
    }
    closeModal('#modalApuracao');
    setPerfilReturnTo('apuracao');
    openPerfil(btn.dataset.iniciar, true);
  }));
  $$('#apurList [data-verapuracao]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal('#modalApuracao');
    setPerfilReturnTo('apuracao');
    openPerfil(btn.dataset.verapuracao);
  }));

  if(ordenarPor === 'manual'){
    let dragSrcId = null;
    $$('#apurList .client-row[draggable="true"]').forEach(row => {
      row.addEventListener('dragstart', () => {
        dragSrcId = row.dataset.id;
        row.style.opacity = '0.4';
      });
      row.addEventListener('dragend', () => { row.style.opacity = ''; });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        row.style.background = 'var(--bg)';
      });
      row.addEventListener('dragleave', () => { row.style.background = ''; });
      row.addEventListener('drop', async (e) => {
        e.preventDefault();
        row.style.background = '';
        const targetId = row.dataset.id;
        if(!dragSrcId || dragSrcId === targetId) return;
        await reorderManual(dragSrcId, targetId);
      });
    });
  }
}

async function reorderManual(srcId, targetId){
  const allIds = DATA.companies.filter(c => !c.baixada).sort((a,b)=>a.razaoSocial.localeCompare(b.razaoSocial)).map(c=>c.id);
  let arr = (DATA.ordemApuracaoManual || []).filter(id => allIds.includes(id));
  allIds.forEach(id => { if(!arr.includes(id)) arr.push(id); });

  const fromIdx = arr.indexOf(srcId);
  if(fromIdx === -1) return;
  arr.splice(fromIdx, 1);
  const toIdx = arr.indexOf(targetId);
  arr.splice(toIdx === -1 ? arr.length : toIdx, 0, srcId);

  DATA.ordemApuracaoManual = arr;
  await saveData();
  renderApurList();
}

$$('#apurChips .chip').forEach(chip => chip.addEventListener('click', () => {
  apurFilter = chip.dataset.afilter;
  $$('#apurChips .chip').forEach(c=>c.classList.remove('active'));
  chip.classList.add('active');
  renderApurList();
}));
$('#apurSearch').addEventListener('input', debounce(renderApurList, 150));
$('#apurDificuldadeFilter').addEventListener('change', renderApurList);
$('#apurRegimeFilter').addEventListener('change', renderApurList);
$('#apurIssqnFilter').addEventListener('change', renderApurList);
$('#apurFatorRFilter').addEventListener('change', renderApurList);
$('#apurOrdenarPor').addEventListener('change', renderApurList);
$('#btnApuracao').addEventListener('click', () => {
  apurFilter = 'PENDENTE';
  $$('#apurChips .chip').forEach(c=>c.classList.remove('active'));
  $('#apurChips .chip.pendente').classList.add('active');
  $('#apurSearch').value = '';
  $('#apurDificuldadeFilter').value = '';
  $('#apurRegimeFilter').value = '';
  $('#apurIssqnFilter').value = '';
  $('#apurFatorRFilter').value = '';
  $('#apurOrdenarPor').value = 'manual';
  renderApuracao();
  openModal('#modalApuracao');
});
