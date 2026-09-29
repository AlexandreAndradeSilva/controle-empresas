/* Encerramento do mes (arquiva a apuracao de cada empresa, gera os PDFs e o
   backup) e as telas de consulta do que ja foi encerrado. */
import { $, $$, debounce, toast, escapeHtml, initials, fmtDate, statusClass, statusLabel,
         docField, docFieldWithValue, formatTempo, monthLabelPT, sanitizeFileName,
         copyableField, copyValue } from './utils.js';
import { DATA, saveData } from './state.js';
import { openModal, closeModal, confirmDialog } from './modal.js';
import { DOC_GROUPS, docGroupsHtml, getImpostosFieldsForCompany, getDeclaracaoFieldsForCompany,
         getObrigacoesFieldsForCompany, getFieldDefault, REINF_TIPOS, isReinfLabel } from './fields.js';
import { buildCompanyPdfBlob } from './pdf.js';
import { verGuia, resolveGuiaBlob, guiaBadgeHtml, bindGuiaButtons } from './guias.js';
import { render, getResponsaveisArray } from './companies.js';
import { renderApuracao } from './apuracao.js';
import { renderCalendario, impostoEnviadoEfetivo } from './calendario.js';
import { tempoApuracaoEfetivo } from './perfil.js';

export async function encerrarApuracaoDoMes(){
  const label = monthLabelPT(new Date());
  if(!(await confirmDialog(`Encerrar a apuração de ${label}?\n\nIsso vai:\n• Gerar um PDF completo de cada empresa (todos os dados da tela de perfil)\n• Gerar um backup completo do sistema (.json)\n• Arquivar os dados de Apuração, Impostos e Declaração no histórico de cada empresa\n• Reiniciar esses campos para o próximo mês (usando os padrões definidos no lápis de cada empresa)\n\nVocê poderá escolher uma pasta para salvar tudo. Essa ação não pode ser desfeita.`, {okLabel:'Encerrar mês'}))) return;

  toast('Encerrando o mês e gerando os PDFs, aguarde...');

  // monta os snapshots e os PDFs antes de resetar os campos
  const pdfFiles = []; // {name, blob}
  const relatorioPorTempo = [];
  const relatorioPorImpostos = [];
  DATA.companies.filter(c => !c.baixada).forEach(c => {
    // consolida o cronômetro (se estiver rodando) antes de arquivar e zerar
    const tempoFinal = tempoApuracaoEfetivo(c);
    const snap = {
      documentos: c.documentos || {},
      impostos: c.impostos || {},
      impostosValores: c.impostosValores || {},
      impostosVencimentos: c.impostosVencimentos || {},
      impostosReinfTipos: c.impostosReinfTipos || {},
      impostosGuias: c.impostosGuias || {},
      declaracao: c.declaracao || {},
      obrigacoes: c.obrigacoes || {},
      observacoesApuracao: c.observacoesApuracao || '',
      tempoApuracaoSegundos: tempoFinal
    };
    pdfFiles.push({ name: `${sanitizeFileName(c.razaoSocial)}.pdf`, blob: buildCompanyPdfBlob(c, snap, label) });

    // captura pro relatório do mês antes de resetar os campos abaixo
    if(tempoFinal > 0) relatorioPorTempo.push({ label: c.razaoSocial, value: tempoFinal });
    const concluidosCount = getImpostosFieldsForCompany(c).filter(([k]) => snap.impostos[k] === 'CONCLUIDO').length;
    if(concluidosCount > 0) relatorioPorImpostos.push({ label: c.razaoSocial, value: concluidosCount });

    c.historico = c.historico || [];
    c.historico.unshift({
      label,
      closedAt: new Date().toISOString(),
      documentos: snap.documentos,
      impostos: snap.impostos,
      impostosValores: snap.impostosValores,
      impostosVencimentos: snap.impostosVencimentos,
      impostosReinfTipos: snap.impostosReinfTipos,
      impostosGuias: snap.impostosGuias,
      declaracao: snap.declaracao,
      obrigacoes: snap.obrigacoes,
      observacoesApuracao: snap.observacoesApuracao,
      tempoApuracaoSegundos: tempoFinal,
      dataConcluida: c.dataConcluida || '',
      fatorRStatus: c.fatorRStatus || 'PENDENTE',
      status: c.status
    });
    c.documentos = {};
    c.impostos = {};
    c.impostosValores = {};
    c.impostosVencimentos = {};
    c.impostosReinfTipos = {};
    c.impostosGuias = {};
    c.impostosEnviado = {};
    c.declaracao = {};
    c.obrigacoes = {};
    c.observacoesApuracao = '';
    c.status = 'PENDENTE';
    c.dataConcluida = '';
    c.fatorRStatus = 'PENDENTE';
    c.tempoApuracaoSegundos = 0;
    c.tempoApuracaoRodando = false;
    c.tempoApuracaoInicio = null;
  });

  // arquiva o relatório do mês (feito com os dados capturados acima, antes do reset)
  DATA.relatoriosHistorico = DATA.relatoriosHistorico || [];
  DATA.relatoriosHistorico.unshift({
    label,
    closedAt: new Date().toISOString(),
    porTempo: relatorioPorTempo.sort((a,b)=>b.value-a.value),
    porImpostos: relatorioPorImpostos.sort((a,b)=>b.value-a.value)
  });

  // marca o início do novo ciclo — a partir de agora, empresas arquivadas em
  // ciclos anteriores não aparecem mais em "Mostrar arquivadas" no calendário/apuração
  DATA.inicioCicloApuracao = new Date().toISOString();

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

if($('#btnEncerrarMes')){
  $('#btnEncerrarMes').addEventListener('click', encerrarApuracaoDoMes);
}
export function getMesesDisponiveis(){
  const map = new Map(); // label -> data mais recente de fechamento (pra ordenar)
  DATA.companies.forEach(c => {
    (c.historico || []).forEach(h => {
      const atual = map.get(h.label);
      if(!atual || h.closedAt > atual) map.set(h.label, h.closedAt);
    });
  });
  return [...map.entries()].sort((a,b) => b[1].localeCompare(a[1])).map(([label]) => label);
}

export function renderMesesAnterioresSelect(){
  const meses = getMesesDisponiveis();
  const sel = $('#mesAnteriorSelect');
  if(meses.length === 0){
    sel.innerHTML = `<option value="">Nenhum mês encerrado ainda</option>`;
  } else {
    sel.innerHTML = meses.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  }
}

export function renderMesAnteriorList(){
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

export function openHistoricoDetalhe(c, h){
  $('#histDetTitulo').textContent = c.razaoSocial + ' — ' + h.label;
  $('#histDetData').textContent = 'Encerrado em ' + fmtDate(h.closedAt.slice(0,10)) + (h.tempoApuracaoSegundos ? (' · tempo de apuração: ' + formatTempo(h.tempoApuracaoSegundos)) : '');
  const d = h.documentos || {};
  const imp = h.impostos || {};
  const impV = h.impostosValores || {};
  const impVenc = h.impostosVencimentos || {};
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
  const impReinfTipos = h.impostosReinfTipos || {};
  const impRows = impFields.map(([k,label,,def]) => {
    const tiposSelecionados = isReinfLabel(label) ? REINF_TIPOS.filter(([tk]) => (impReinfTipos[k]||{})[tk]).map(([,tl])=>tl) : [];
    return `
    <div class="client-row" style="cursor:default;align-items:flex-start;flex-wrap:wrap;gap:10px">
      <div style="min-width:140px;font-weight:700;font-size:.85rem;padding-top:2px">
        ${escapeHtml(label)}
        ${impVenc[k] ? `<div class="small-muted" style="font-weight:600;margin-top:2px">Venceu em ${fmtDate(impVenc[k])}</div>` : ''}
        ${tiposSelecionados.length ? `<div class="small-muted" style="font-weight:600;margin-top:2px">${tiposSelecionados.join(', ')}</div>` : ''}
      </div>
      <div style="flex:1;min-width:160px">${docFieldWithValue('', imp[k]||def, impV[k])}</div>
      <div>${guiaHistBadge(k)}</div>
    </div>`;
  }).join('');
  const declFields = getDeclaracaoFieldsForCompany(c);
  const obrig = h.obrigacoes || {};
  const obrigFields = getObrigacoesFieldsForCompany(c);
  $('#histDetBody').innerHTML = `
    <div class="section-title">Declaração</div>
    <div class="${declFields.length===3?'row3':'row2'}">${declFields.map(([k,label,,def])=>docField(label, dec[k]||def)).join('')}</div>
    ${obrigFields.length ? `
    <div class="section-title">Obrigações</div>
    <div class="${obrigFields.length===2?'row2':'row3'}">${obrigFields.map(([k,label,,def])=>docField(label, k==='dctfWeb'?(dec[k]||def):(obrig[k]||def))).join('')}</div>` : ''}
    <div class="section-title">Apuração</div>
    ${docGroupsHtml((k, [, label,, def]) => docField(label, d[k]||def))}
    <div class="section-title">Impostos</div>
    ${impRows}
    ${h.observacoesApuracao ? `<div class="section-title">Observações</div><div style="background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:10px 12px;font-size:.85rem;line-height:1.5;white-space:pre-wrap">${escapeHtml(h.observacoesApuracao)}</div>` : ''}
  `;
  $$('#histDetBody [data-verguiahist]').forEach(btn => btn.addEventListener('click', () => {
    verGuia(impG[btn.dataset.verguiahist]);
  }));
  $$('#histDetBody [data-baixarguiahist]').forEach(btn => btn.addEventListener('click', async () => {
    const g = impG[btn.dataset.baixarguiahist];
    if(!g) return;
    toast('Carregando guia...');
    const blob = await resolveGuiaBlob(g);
    if(!blob){ toast('Não foi possível carregar essa guia.'); return; }
    const a = document.createElement('a');
    a.href = blob.dataUrl;
    a.download = blob.filename || g.filename || 'guia.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }));
  openModal('#modalHistoricoDetalhe');
}

function openImpostoOrfaoView(c, key){
  const impVenc = c.impostosVencimentos || {};
  $('#histDetTitulo').textContent = c.razaoSocial;
  $('#histDetData').textContent = 'Lembrete não identificado' + (impVenc[key] ? (' · vencia em ' + fmtDate(impVenc[key])) : '');
  $('#histDetBody').innerHTML = `
    <div class="banner" style="display:flex;background:#fde3e8;border-color:#f5c2ce;color:#9c2c46">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="flex:none;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span>Esse lembrete não corresponde a nenhum imposto configurado atualmente para essa empresa (regime: <strong>${escapeHtml(c.regime)||'nenhum'}</strong>). O imposto original pode ter sido removido ou renomeado em "Gerenciar Impostos".</span>
    </div>
    <div class="modal-actions" style="justify-content:flex-start;margin-top:16px">
      <button class="btn btn-danger btn-sm" id="btnRemoverVencOrfao">Remover este lembrete</button>
    </div>
  `;
  $('#btnRemoverVencOrfao').addEventListener('click', async () => {
    const ok2go = await confirmDialog('Remover esse lembrete de vencimento? Ele não corresponde a nenhum imposto ativo dessa empresa.', {okLabel:'Remover'});
    if(!ok2go) return;
    if(c.impostosVencimentos) delete c.impostosVencimentos[key];
    await saveData();
    closeModal('#modalHistoricoDetalhe');
    if($('#modalCalendario').classList.contains('show')) renderCalendario();
    toast('Lembrete removido.');
  });
  openModal('#modalHistoricoDetalhe');
}

export function openImpostoDetalheView(c, key){
  const fields = getImpostosFieldsForCompany(c);
  const field = fields.find(f => f[0] === key);
  if(!field){ openImpostoOrfaoView(c, key); return; }
  const [, label,, def] = field;
  const imp = c.impostos || {};
  const impV = c.impostosValores || {};
  const impVenc = c.impostosVencimentos || {};
  const impObs = c.impostosObservacoes || {};
  const resp = getResponsaveisArray(c)[0] || {};
  const eff = imp[key] || getFieldDefault(c, 'impostosPadrao', key, def);
  const enviado = impostoEnviadoEfetivo(c, key);

  $('#histDetTitulo').textContent = c.razaoSocial;
  $('#histDetData').textContent = label + (impVenc[key] ? (' · vence em ' + fmtDate(impVenc[key])) : '');

  let infoTop = `
    <div class="row2" style="align-items:flex-end">
      <div class="field" style="max-width:220px;margin-bottom:0">
        <label>Esse imposto já foi enviado?</label>
        <select id="impDetStatusSelect" class="${enviado?'sel-ok':'sel-late'}">
          <option value="NAO" ${!enviado?'selected':''}>Não</option>
          <option value="SIM" ${enviado?'selected':''}>Sim</option>
        </select>
      </div>
      ${impVenc[key] ? `<button type="button" class="btn btn-outline btn-sm" id="btnExcluirAvisoImposto" title="Excluir só este aviso do calendário (a apuração continua salva)" style="flex:none;color:var(--red);border-color:var(--red)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Excluir aviso</button>` : ''}
    </div>
    <div class="field" style="margin-top:10px">
      <label>Observações (ex: pra quem foi encaminhado)</label>
      <textarea id="impDetObservacoes" rows="2" placeholder="Ex: Encaminhado para Juliane em 05/09...">${escapeHtml(impObs[key]||'')}</textarea>
    </div>
    <div class="divider"></div>
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

  const tiposSelecionados = isReinfLabel(label) ? REINF_TIPOS.filter(([tk]) => ((c.impostosReinfTipos||{})[key]||{})[tk]).map(([,tl])=>tl) : [];
  const body = infoTop + `<div class="divider"></div>
    <div class="client-row" style="cursor:default;align-items:flex-start;flex-wrap:wrap;gap:10px">
      <div style="min-width:140px;font-weight:700;font-size:.85rem;padding-top:2px">
        ${escapeHtml(label)}
        ${impVenc[key] ? `<div class="small-muted" style="font-weight:600;margin-top:2px">Vence em ${fmtDate(impVenc[key])}</div>` : ''}
        ${tiposSelecionados.length ? `<div class="small-muted" style="font-weight:600;margin-top:2px">${tiposSelecionados.join(', ')}</div>` : ''}
      </div>
      <div style="flex:1;min-width:160px">${docFieldWithValue('', eff, impV[key])}</div>
      <div>${guiaBadgeHtml(c,key)}</div>
    </div>`;
  $('#histDetBody').innerHTML = body;
  $$('#histDetBody .copy-field[data-copy]').forEach(el => {
    el.addEventListener('click', () => copyValue(el.dataset.copy, el.dataset.label));
  });
  bindGuiaButtons($('#histDetBody'), c, () => openImpostoDetalheView(c, key));
  $('#impDetStatusSelect').addEventListener('change', async (e) => {
    c.impostosEnviado = c.impostosEnviado || {};
    c.impostosEnviado[key] = e.target.value === 'SIM';
    await saveData();
    render();
    if($('#modalCalendario').classList.contains('show')) renderCalendario();
    openImpostoDetalheView(c, key);
    toast('Marcação atualizada.');
  });
  $('#impDetObservacoes').addEventListener('change', async (e) => {
    c.impostosObservacoes = c.impostosObservacoes || {};
    c.impostosObservacoes[key] = e.target.value;
    await saveData();
    toast('Observação salva.');
  });
  const btnExcluirAviso = $('#btnExcluirAvisoImposto');
  if(btnExcluirAviso){
    btnExcluirAviso.addEventListener('click', async () => {
      const ok2go = await confirmDialog('Excluir este aviso do calendário? A apuração e o histórico dessa empresa continuam salvos, só esse lembrete de vencimento some do calendário.', {okLabel:'Excluir aviso'});
      if(!ok2go) return;
      if(c.impostosVencimentos) delete c.impostosVencimentos[key];
      await saveData();
      closeModal('#modalHistoricoDetalhe');
      if($('#modalCalendario').classList.contains('show')) renderCalendario();
      toast('Aviso removido do calendário.');
    });
  }
  openModal('#modalHistoricoDetalhe');
}
