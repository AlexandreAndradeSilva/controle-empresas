import { $, $$, debounce, escapeHtml, initials, fmtDate, statusClass, statusLabel, docFieldWithValue, copyableField, copyValue } from './utils.js';
import { DATA, saveData, setPerfilReturnTo } from './state.js';
import { openModal, closeModal } from './modal.js';
import { IMPOSTOS_FIELDS, getImpostosFieldsForCompany, hasImpostoConcluido, docsProgressPercent } from './fields.js';
import { guiaBadgeHtml, bindGuiaButtons } from './guias.js';
import { openPerfil } from './perfil.js';

let apurFilter = 'todas';

export function renderApuracao(){
  const list = DATA.companies.filter(c => !c.baixada);
  $('#aTotal').textContent = list.length;
  $('#aPendente').textContent = list.filter(c=>c.status==='PENDENTE').length;
  $('#aAndamento').textContent = list.filter(c=>c.status==='ANDAMENTO').length;
  $('#aConcluida').textContent = list.filter(c=>c.status==='CONCLUIDA').length;
  $('#aFinalizadas').textContent = list.filter(c=>hasImpostoConcluido(c)).length;
  populateImpostoTipoFilter();
  renderApurList();
}

function populateImpostoTipoFilter(){
  const sel = $('#apurImpostoTipoFilter');
  const currentValue = sel.value;
  const custom = (DATA.impostosCustom || []).map(f => [f.key, f.label]);
  const all = IMPOSTOS_FIELDS.map(([k,label]) => [k,label]).concat(custom);
  sel.innerHTML = `<option value="">Tipo de imposto: todos</option>` +
    all.map(([k,label]) => `<option value="${k}">${escapeHtml(label)}</option>`).join('');
  if(all.some(([k]) => k === currentValue)) sel.value = currentValue;
}

function renderApurList(){
  $('#apurImpostoTipoFilter').style.display = (apurFilter === 'finalizadas') ? 'inline-flex' : 'none';
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
  if(apurFilter === 'finalizadas'){
    list = list.filter(c => hasImpostoConcluido(c));
  } else if(apurFilter !== 'todas'){
    list = list.filter(c => c.status === apurFilter);
  }
  const decFilter = $('#apurDeclaracaoFilter').value;
  if(decFilter){
    list = list.filter(c => ((c.declaracao && c.declaracao.declaracao) || 'PENDENTE') === decFilter);
  }
  const dificFilter = $('#apurDificuldadeFilter').value;
  if(dificFilter){
    list = list.filter(c => c.dificuldade === dificFilter);
  }
  const regimeFilter = $('#apurRegimeFilter').value;
  if(regimeFilter){
    list = list.filter(c => c.regime === regimeFilter);
  }
  const impostoTipoFilter = $('#apurImpostoTipoFilter').value;
  if(impostoTipoFilter){
    list = list.filter(c => (c.impostos && c.impostos[impostoTipoFilter]) === 'CONCLUIDO');
  }

  const ordenarPor = $('#apurOrdenarPor').value;
  $('#apurDragHint').style.display = (ordenarPor === 'manual') ? 'block' : 'none';
  const semVenc = '9999-99-99';
  function manualIdx(id){
    const arr = DATA.ordemApuracaoManual || [];
    const idx = arr.indexOf(id);
    return idx === -1 ? Infinity : idx;
  }
  list = list.slice().sort((a,b) => {
    switch(ordenarPor){
      case 'manual': {
        const d = manualIdx(a.id) - manualIdx(b.id);
        return d !== 0 ? d : a.razaoSocial.localeCompare(b.razaoSocial);
      }
      case 'nome_za': return b.razaoSocial.localeCompare(a.razaoSocial);
      case 'venc_prox': return (a.vencimento||semVenc).localeCompare(b.vencimento||semVenc);
      case 'venc_dist': return (b.vencimento||'').localeCompare(a.vencimento||'');
      case 'progresso_menor': return docsProgressPercent(a.documentos, a.documentosPadrao, a.declaracao) - docsProgressPercent(b.documentos, b.documentosPadrao, b.declaracao);
      case 'progresso_maior': return docsProgressPercent(b.documentos, b.documentosPadrao, b.declaracao) - docsProgressPercent(a.documentos, a.documentosPadrao, a.declaracao);
      default: return a.razaoSocial.localeCompare(b.razaoSocial);
    }
  });

  $('#apurCount').textContent = list.length + (list.length===1 ? ' empresa encontrada' : ' empresas encontradas');
  const box = $('#apurList');

  if(list.length === 0){
    box.innerHTML = `<div class="empty">Nenhuma empresa encontrada.</div>`;
    return;
  }

  box.innerHTML = list.map(c => `
    <div class="client-row" data-id="${c.id}" ${ordenarPor==='manual' ? 'draggable="true"' : ''} style="${ordenarPor==='manual' ? 'cursor:grab' : ''}">
      <div class="client-main">
        ${ordenarPor==='manual' ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="currentColor" class="icon-svg" style="color:var(--muted);flex:none;margin-right:2px"><circle cx="8" cy="6" r="1.6"/><circle cx="8" cy="12" r="1.6"/><circle cx="8" cy="18" r="1.6"/><circle cx="16" cy="6" r="1.6"/><circle cx="16" cy="12" r="1.6"/><circle cx="16" cy="18" r="1.6"/></svg>` : ''}
        <div class="avatar">${initials(c.razaoSocial)||'?'}</div>
        <div style="min-width:0">
          <div class="client-name">${escapeHtml(c.razaoSocial)}</div>
          <div class="client-meta">${c.numero?('Nº '+c.numero+' · '):''}${c.municipio||''}${c.uf?'/'+c.uf:''} ${c.vencimento ? '· vence '+fmtDate(c.vencimento) : ''}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex:none">
        ${apurFilter === 'todas' ? `
          <span class="status-pill ${statusClass(c.status)}">${statusLabel(c.status)}</span>
          <span style="display:inline-flex;align-items:center;gap:5px">
            <span style="display:inline-block;width:60px;height:7px;background:var(--line);border-radius:4px;overflow:hidden">
              <span style="display:block;height:100%;width:${docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao)}%;background:var(--green)"></span>
            </span>
            <span class="small-muted" style="font-size:.7rem">${docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao)}%</span>
          </span>
        ` : ''}
        ${apurFilter === 'finalizadas'
          ? `<button class="btn btn-outline btn-sm" data-verimpostos="${c.id}">Ver</button>`
          : `<button class="btn btn-outline btn-sm" data-iniciar="${c.id}">Iniciar</button>`}
      </div>
    </div>`).join('');

  $$('#apurList [data-iniciar]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal('#modalApuracao');
    setPerfilReturnTo('apuracao');
    openPerfil(btn.dataset.iniciar, true);
  }));
  $$('#apurList [data-verimpostos]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const c = DATA.companies.find(x => x.id === btn.dataset.verimpostos);
    if(c) openImpostosConcluidosView(c);
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

function openImpostosConcluidosView(c){
  $('#histDetTitulo').textContent = c.razaoSocial;
  $('#histDetData').textContent = 'Impostos marcados como Concluído';
  const imp = c.impostos || {};
  const impV = c.impostosValores || {};
  const resp = c.responsavelEmpresa || {};

  let infoTop = `
    <div class="row2">
      ${copyableField('CNPJ / CPF', c.cnpj)}
      <div><span class="small-muted">Nome do responsável</span><br><strong>${escapeHtml(resp.nome)||'—'}</strong></div>
    </div>`;
  const contatoRows = [];
  if((resp.telefone||'').trim()) contatoRows.push(copyableField('Telefone', resp.telefone));
  if((resp.email||'').trim()) contatoRows.push(copyableField('E-mail', resp.email));
  if((resp.outros||'').trim()) contatoRows.push(copyableField('Outros', resp.outros));
  for(let i=0;i<contatoRows.length;i+=2){
    infoTop += `<div class="row2" style="margin-top:10px">${contatoRows[i]}${contatoRows[i+1]||''}</div>`;
  }

  const fields = getImpostosFieldsForCompany(c).filter(([k]) => imp[k] === 'CONCLUIDO');
  let body = infoTop + `<div class="divider"></div>`;
  if(fields.length === 0){
    body += `<div class="empty">Nenhum imposto concluído ainda para esta empresa.</div>`;
  } else {
    body += fields.map(([k,label,,def]) => `
      <div class="client-row" style="cursor:default;align-items:flex-start;flex-wrap:wrap;gap:10px">
        <div style="min-width:140px;font-weight:700;font-size:.85rem;padding-top:2px">${escapeHtml(label)}</div>
        <div style="flex:1;min-width:160px">${docFieldWithValue('', imp[k]||def, impV[k])}</div>
        <div>${guiaBadgeHtml(c,k)}</div>
      </div>`).join('');
  }
  $('#histDetBody').innerHTML = body;
  $$('#histDetBody .copy-field[data-copy]').forEach(el => {
    el.addEventListener('click', () => copyValue(el.dataset.copy, el.dataset.label));
  });
  bindGuiaButtons($('#histDetBody'), c, () => openImpostosConcluidosView(c));
  openModal('#modalHistoricoDetalhe');
}

$$('#apurChips .chip').forEach(chip => chip.addEventListener('click', () => {
  apurFilter = chip.dataset.afilter;
  $$('#apurChips .chip').forEach(c=>c.classList.remove('active'));
  chip.classList.add('active');
  if(apurFilter !== 'finalizadas') $('#apurImpostoTipoFilter').value = '';
  renderApurList();
}));
$('#apurSearch').addEventListener('input', debounce(renderApurList, 150));
$('#apurDeclaracaoFilter').addEventListener('change', renderApurList);
$('#apurDificuldadeFilter').addEventListener('change', renderApurList);
$('#apurRegimeFilter').addEventListener('change', renderApurList);
$('#apurImpostoTipoFilter').addEventListener('change', renderApurList);
$('#apurOrdenarPor').addEventListener('change', renderApurList);
$('#btnApuracao').addEventListener('click', () => {
  apurFilter = 'todas';
  $$('#apurChips .chip').forEach(c=>c.classList.remove('active'));
  $('#apurChips .chip.total').classList.add('active');
  $('#apurSearch').value = '';
  $('#apurDeclaracaoFilter').value = '';
  $('#apurDificuldadeFilter').value = '';
  $('#apurRegimeFilter').value = '';
  $('#apurImpostoTipoFilter').value = '';
  $('#apurOrdenarPor').value = 'manual';
  renderApuracao();
  openModal('#modalApuracao');
});
