import { $, $$, debounce, toast, escapeHtml, initials, fmtDate, statusClass, statusLabel, docField, docFieldWithValue } from './utils.js';
import { DATA, saveData } from './state.js';
import { openModal, closeModal } from './modal.js';
import { DOC_FIELDS, DECLARACAO_FIELDS, getImpostosFieldsForCompany } from './fields.js';
import { monthLabelPT, sanitizeFileName, buildCompanyPdfBlob } from './pdf.js';
import { verGuia, downloadGuia } from './guias.js';
import { render } from './companies.js';
import { renderApuracao } from './apuracao.js';

/* ---------------- encerramento mensal e histórico ---------------- */
async function encerrarApuracaoDoMes(){
  const label = monthLabelPT(new Date());
  if(!confirm(`Encerrar a apuração de ${label}?\n\nIsso vai:\n• Gerar um PDF completo de cada empresa (todos os dados da tela de perfil)\n• Gerar um backup completo do sistema (.json)\n• Arquivar os dados de Apuração, Impostos e Declaração no histórico de cada empresa\n• Reiniciar esses campos para o próximo mês (usando os padrões definidos no lápis de cada empresa)\n\nVocê poderá escolher uma pasta para salvar tudo. Essa ação não pode ser desfeita.`)) return;

  toast('Encerrando o mês e gerando os PDFs, aguarde...');

  // monta os snapshots e os PDFs antes de resetar os campos
  const pdfFiles = []; // {name, blob}
  DATA.companies.filter(c => !c.baixada).forEach(c => {
    const snap = {
      documentos: c.documentos || {},
      impostos: c.impostos || {},
      impostosValores: c.impostosValores || {},
      impostosGuias: c.impostosGuias || {},
      declaracao: c.declaracao || {},
      observacoesApuracao: c.observacoesApuracao || ''
    };
    pdfFiles.push({ name: `${sanitizeFileName(c.razaoSocial)}.pdf`, blob: buildCompanyPdfBlob(c, snap, label) });

    c.historico = c.historico || [];
    c.historico.unshift({
      label,
      closedAt: new Date().toISOString(),
      documentos: snap.documentos,
      impostos: snap.impostos,
      impostosValores: snap.impostosValores,
      impostosGuias: snap.impostosGuias,
      declaracao: snap.declaracao,
      observacoesApuracao: snap.observacoesApuracao,
      status: c.status
    });
    c.documentos = {};
    c.impostos = {};
    c.impostosValores = {};
    c.impostosGuias = {};
    c.declaracao = {};
    c.observacoesApuracao = '';
    c.status = 'PENDENTE';
  });

  await saveData();
  render();
  renderApuracao();

  const backupJson = JSON.stringify(DATA, null, 2);

  // tenta salvar direto numa pasta escolhida pelo usuário (quando o navegador permitir)
  let savedToRealFolder = false;
  if(window.showDirectoryPicker){
    try{
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
      if(perm === 'granted'){
        const subDir = await dirHandle.getDirectoryHandle(`Apuracao ${label.replace('/','-')}`, { create: true });
        const backupHandle = await subDir.getFileHandle('backup-sistema.json', { create: true });
        const backupWritable = await backupHandle.createWritable();
        await backupWritable.write(backupJson);
        await backupWritable.close();
        for(const f of pdfFiles){
          const fh = await subDir.getFileHandle(f.name, { create: true });
          const w = await fh.createWritable();
          await w.write(f.blob);
          await w.close();
        }
        savedToRealFolder = true;
      }
    }catch(e){
      if(e.name !== 'AbortError'){ console.error(e); }
      // segue para o fallback de download em zip
    }
  }

  if(savedToRealFolder){
    toast(`Apuração de ${label} encerrada — PDFs e backup salvos na pasta escolhida.`);
    return;
  }

  // fallback: navegador não permite pasta real aqui — baixa tudo compactado em .zip
  try{
    const zip = new JSZip();
    const folder = zip.folder(`Apuracao ${label.replace('/','-')}`);
    folder.file('backup-sistema.json', backupJson);
    pdfFiles.forEach(f => folder.file(f.name, f.blob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apuracao-${label.replace('/','-')}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`Apuração de ${label} encerrada — PDFs e backup baixados em .zip (este ambiente não permite escolher a pasta diretamente).`);
  }catch(e){
    console.error(e);
    toast(`Apuração de ${label} encerrada, mas houve um erro ao gerar os arquivos.`);
  }
}

$('#btnEncerrarMes').addEventListener('click', encerrarApuracaoDoMes);

/* ---------------- meses anteriores (consulta consolidada) ---------------- */
function getMesesDisponiveis(){
  const map = new Map(); // label -> data mais recente de fechamento (pra ordenar)
  DATA.companies.forEach(c => {
    (c.historico || []).forEach(h => {
      const atual = map.get(h.label);
      if(!atual || h.closedAt > atual) map.set(h.label, h.closedAt);
    });
  });
  return [...map.entries()].sort((a,b) => b[1].localeCompare(a[1])).map(([label]) => label);
}

function renderMesesAnterioresSelect(){
  const meses = getMesesDisponiveis();
  const sel = $('#mesAnteriorSelect');
  if(meses.length === 0){
    sel.innerHTML = `<option value="">Nenhum mês encerrado ainda</option>`;
  } else {
    sel.innerHTML = meses.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  }
}

function renderMesAnteriorList(){
  const label = $('#mesAnteriorSelect').value;
  const q = $('#mesAnteriorSearch').value.trim().toLowerCase();
  const box = $('#mesAnteriorList');
  if(!label){
    box.innerHTML = `<div class="empty">Nenhum mês encerrado ainda — use "Encerrar mês" na Apuração para começar a ter histórico aqui.</div>`;
    $('#mesAnteriorCount').textContent = '';
    return;
  }
  let itens = DATA.companies
    .map(c => ({ c, h: (c.historico||[]).find(h => h.label === label) }))
    .filter(({h}) => h);
  if(q){
    itens = itens.filter(({c}) => c.razaoSocial.toLowerCase().includes(q));
  }
  itens.sort((a,b) => a.c.razaoSocial.localeCompare(b.c.razaoSocial));

  $('#mesAnteriorCount').textContent = itens.length + (itens.length===1 ? ' empresa encontrada' : ' empresas encontradas');

  if(itens.length === 0){
    box.innerHTML = `<div class="empty">Nenhuma empresa encontrada para ${escapeHtml(label)}.</div>`;
    return;
  }

  box.innerHTML = itens.map(({c,h}) => `
    <div class="client-row" data-id="${c.id}">
      <div class="client-main">
        <div class="avatar">${initials(c.razaoSocial)||'?'}</div>
        <div style="min-width:0">
          <div class="client-name">${escapeHtml(c.razaoSocial)}</div>
          <div class="client-meta">${c.numero?('Nº '+c.numero+' · '):''}${c.municipio||''}${c.uf?'/'+c.uf:''}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex:none">
        <span class="status-pill ${statusClass(h.status)}">${statusLabel(h.status)}</span>
        <button class="btn btn-outline btn-sm" data-vermes="${c.id}">Ver</button>
      </div>
    </div>`).join('');

  $$('#mesAnteriorList [data-vermes]').forEach(btn => btn.addEventListener('click', () => {
    const { c, h } = itens.find(({c}) => c.id === btn.dataset.vermes);
    openHistoricoDetalhe(c, h);
  }));
}

$('#btnHistoricoMeses').addEventListener('click', () => {
  closeModal('#modalApuracao');
  renderMesesAnterioresSelect();
  $('#mesAnteriorSearch').value = '';
  renderMesAnteriorList();
  openModal('#modalMesesAnteriores');
});
$('#mesAnteriorSelect').addEventListener('change', renderMesAnteriorList);
$('#mesAnteriorSearch').addEventListener('input', debounce(renderMesAnteriorList, 150));

function openHistoricoDetalhe(c, h){
  $('#histDetTitulo').textContent = c.razaoSocial + ' — ' + h.label;
  $('#histDetData').textContent = 'Encerrado em ' + fmtDate(h.closedAt.slice(0,10));
  const d = h.documentos || {};
  const imp = h.impostos || {};
  const impV = h.impostosValores || {};
  const impG = h.impostosGuias || {};
  const dec = h.declaracao || {};
  const impFields = getImpostosFieldsForCompany(c);
  const guiaHistBadge = (key) => {
    const g = impG[key];
    if(!g) return '';
    return `<div style="margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <span class="small-muted" style="font-size:.7rem;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(g.filename)}">${escapeHtml(g.filename)}</span>
      <button class="btn btn-outline btn-sm" data-verguiahist="${key}" style="padding:3px 8px;font-size:.7rem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg> Ver</button>
      <button class="btn btn-outline btn-sm" data-baixarguiahist="${key}" style="padding:3px 8px;font-size:.7rem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg> Baixar</button>
    </div>`;
  };
  const impRows = impFields.map(([k,label,,def]) => `
    <div class="client-row" style="cursor:default;align-items:flex-start;flex-wrap:wrap;gap:10px">
      <div style="min-width:140px;font-weight:700;font-size:.85rem;padding-top:2px">${escapeHtml(label)}</div>
      <div style="flex:1;min-width:160px">${docFieldWithValue('', imp[k]||def, impV[k])}</div>
      <div>${guiaHistBadge(k)}</div>
    </div>`).join('');
  $('#histDetBody').innerHTML = `
    <div class="section-title">Declaração</div>
    <div class="row3">${DECLARACAO_FIELDS.map(([k,label,,def])=>docField(label, dec[k]||def)).join('')}</div>
    <div class="section-title">Apuração</div>
    <div class="row4">${DOC_FIELDS.slice(0,4).map(([k,label,,def])=>docField(label, d[k]||def)).join('')}</div>
    <div class="row4" style="margin-top:10px">${DOC_FIELDS.slice(4,8).map(([k,label,,def])=>docField(label, d[k]||def)).join('')}</div>
    <div class="section-title">Impostos</div>
    ${impRows}
    ${h.observacoesApuracao ? `<div class="section-title">Observações</div><div style="background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:10px 12px;font-size:.85rem;line-height:1.5;white-space:pre-wrap">${escapeHtml(h.observacoesApuracao)}</div>` : ''}
  `;
  $$('#histDetBody [data-verguiahist]').forEach(btn => btn.addEventListener('click', () => {
    verGuia(impG[btn.dataset.verguiahist]);
  }));
  $$('#histDetBody [data-baixarguiahist]').forEach(btn => btn.addEventListener('click', () => {
    downloadGuia({ impostosGuias: impG }, btn.dataset.baixarguiahist);
  }));
  openModal('#modalHistoricoDetalhe');
}
