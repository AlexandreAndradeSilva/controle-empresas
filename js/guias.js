/* Guias em PDF anexadas a um imposto.

   No artefato original o PDF ia em base64 dentro do proprio registro; aqui ele
   vai para o Storage do Supabase (bucket privado `guias`) e o registro guarda
   so a referencia { filename, path }. Para ver ou baixar, o app pede uma URL
   assinada de curta duracao. */
import { supabase } from './supabaseClient.js';
import { $, toast, escapeHtml, moneyStrToNumber } from './utils.js';
import { DATA, saveData, getOwnerId, currentProfileId } from './state.js';
import { docsProgressPercent, atualizarStatusEData } from './fields.js';
import { openModal, closeModal, confirmDialog } from './modal.js';
import { render } from './companies.js';
import { renderImpostosSection } from './perfil.js';

const BUCKET = 'guias';
const TAMANHO_MAXIMO = 3 * 1024 * 1024;

let guiaTargetKey = null;
let guiaTargetCompanyId = null;

/* Marcar um imposto como Concluído já abre o seletor da guia. */
document.addEventListener('change', (e) => {
  if(e.target.matches && e.target.matches('select[data-impkey]') && e.target.value === 'CONCLUIDO'){
    const impKey = e.target.dataset.impkey;
    const c = DATA.companies.find(x => x.id === currentProfileId);
    if(c){
      guiaTargetKey = impKey;
      guiaTargetCompanyId = c.id;
      $('#guiaFileInput').value = '';
      $('#guiaFileInput').click();
    }
  }
});

/* Lê de volta o que está selecionado na tela agora, mesmo sem ter clicado em
   "Salvar" — senão a escolha de Concluído se perde quando a seção é redesenhada
   depois de anexar. */
function sincronizarTelaNaEmpresa(c){
  const impostosSecEl = document.getElementById('impostosSection');
  if(impostosSecEl){
    const novoImp = { ...(c.impostos||{}) };
    impostosSecEl.querySelectorAll('select[data-impkey]').forEach(sel => { novoImp[sel.dataset.impkey] = sel.value; });
    c.impostos = novoImp;
    const novoImpV = { ...(c.impostosValores||{}) };
    impostosSecEl.querySelectorAll('input[data-impvalue]').forEach(inp => { novoImpV[inp.dataset.impvalue] = moneyStrToNumber(inp.value); });
    c.impostosValores = novoImpV;
    const novoImpVenc = { ...(c.impostosVencimentos||{}) };
    impostosSecEl.querySelectorAll('input[data-impvenc]').forEach(inp => { novoImpVenc[inp.dataset.impvenc] = inp.value; });
    c.impostosVencimentos = novoImpVenc;
    const novoReinfTipos = { ...(c.impostosReinfTipos||{}) };
    impostosSecEl.querySelectorAll('input[data-reinftipo]').forEach(inp => {
      const k = inp.dataset.reinftipo;
      novoReinfTipos[k] = novoReinfTipos[k] || {};
      novoReinfTipos[k][inp.dataset.reinftipovalor] = inp.checked;
    });
    c.impostosReinfTipos = novoReinfTipos;
  }
  const docsSecEl = document.getElementById('docsSection');
  if(docsSecEl){
    const novoDoc = { ...(c.documentos||{}) };
    docsSecEl.querySelectorAll('select[data-dockey]').forEach(sel => { novoDoc[sel.dataset.dockey] = sel.value; });
    c.documentos = novoDoc;
  }
  const decSecEl = document.getElementById('declaracaoSection');
  if(decSecEl){
    const novoDec = { ...(c.declaracao||{}) };
    decSecEl.querySelectorAll('select[data-deckey]').forEach(sel => { novoDec[sel.dataset.deckey] = sel.value; });
    c.declaracao = novoDec;
  }
  const obrigSecEl = document.getElementById('obrigacoesSection');
  if(obrigSecEl){
    const novoDec2 = { ...(c.declaracao||{}) };
    obrigSecEl.querySelectorAll('select[data-deckey]').forEach(sel => { novoDec2[sel.dataset.deckey] = sel.value; });
    c.declaracao = novoDec2;
    const novoObrig = { ...(c.obrigacoes||{}) };
    obrigSecEl.querySelectorAll('select[data-obrigkey]').forEach(sel => { novoObrig[sel.dataset.obrigkey] = sel.value; });
    c.obrigacoes = novoObrig;
  }
  const fatorRSecEl = document.getElementById('fatorRSection');
  if(fatorRSecEl){
    const fatorRSel = fatorRSecEl.querySelector('select[data-fatorrstatus]');
    if(fatorRSel) c.fatorRStatus = fatorRSel.value;
  }
  const pct = docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao, c.regime, c.obrigacoes, c.fatorR, c.fatorRStatus);
  atualizarStatusEData(c, pct);
  return !!impostosSecEl;
}

$('#guiaFileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const c = DATA.companies.find(x => x.id === guiaTargetCompanyId);
  if(!guiaTargetKey || !c) return;

  const temSecaoImpostos = sincronizarTelaNaEmpresa(c);
  const redesenhar = () => { if(temSecaoImpostos) renderImpostosSection(c, true); };

  if(!file){
    // desistiu de escolher o arquivo — o status marcado continua valendo
    await saveData();
    render();
    redesenhar();
    return;
  }
  if(file.type !== 'application/pdf'){
    toast('Selecione um arquivo em PDF. O status foi salvo mesmo assim.');
    await saveData();
    redesenhar();
    return;
  }
  if(file.size > TAMANHO_MAXIMO){
    toast('O PDF é muito grande (máximo 3MB). O status foi salvo, mas a guia não foi anexada.');
    await saveData();
    redesenhar();
    return;
  }
  try{
    const path = `${getOwnerId()}/${c.id}/${guiaTargetKey}_${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: true });
    if(uploadError) throw uploadError;

    c.impostosGuias = c.impostosGuias || {};
    c.impostosGuias[guiaTargetKey] = { filename: file.name, path };
    const ok = await saveData();
    toast(ok ? 'Status salvo e guia anexada com sucesso.' : 'Não foi possível salvar a guia.');
    redesenhar();
    render();
  }catch(err){
    console.error(err);
    toast('Não foi possível anexar o arquivo.');
  }
});

async function signedUrlFor(g){
  if(!g || !g.path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(g.path, 3600);
  if(error){ console.error(error); return null; }
  return data.signedUrl;
}

/* Baixa o PDF e devolve { filename, dataUrl } com uma object URL local — a
   mesma forma que o resto do app já esperava do artefato original. */
export async function resolveGuiaBlob(g){
  if(!g) return null;
  const url = await signedUrlFor(g);
  if(!url) return null;
  try{
    const res = await fetch(url);
    if(!res.ok) return null;
    const blob = await res.blob();
    return { filename: g.filename, dataUrl: URL.createObjectURL(blob) };
  }catch(e){
    console.error(e);
    return null;
  }
}

function dispararDownload(dataUrl, filename){
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename || 'guia.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadGuia(c, key){
  const g = (c.impostosGuias || {})[key];
  if(!g) return;
  toast('Carregando guia...');
  const blob = await resolveGuiaBlob(g);
  if(!blob){ toast('Não foi possível carregar essa guia.'); return; }
  dispararDownload(blob.dataUrl, blob.filename || g.filename);
  URL.revokeObjectURL(blob.dataUrl);
}

export async function verGuia(g){
  if(!g) return;
  $('#verGuiaTitulo').textContent = g.filename || 'Guia';
  $('#verGuiaFrame').removeAttribute('src');
  openModal('#modalVerGuia');
  const url = await signedUrlFor(g);
  if(!url){
    toast('Não foi possível carregar essa guia.');
    closeModal('#modalVerGuia');
    return;
  }
  $('#verGuiaFrame').src = url;
  $('#btnBaixarGuiaAberta').onclick = async () => {
    const blob = await resolveGuiaBlob(g);
    if(!blob){ toast('Não foi possível baixar essa guia.'); return; }
    dispararDownload(blob.dataUrl, blob.filename || g.filename);
    URL.revokeObjectURL(blob.dataUrl);
  };
}

export async function removerGuia(c, key){
  if(!(await confirmDialog('Remover essa guia anexada?', {okLabel:'Remover'}))) return;
  const g = (c.impostosGuias || {})[key];
  if(c.impostosGuias) delete c.impostosGuias[key];
  await saveData();
  if(g && g.path){
    const { error } = await supabase.storage.from(BUCKET).remove([g.path]);
    if(error) console.error(error);
  }
  toast('Guia removida.');
}

export function guiaBadgeHtml(c, key){
  const g = (c.impostosGuias || {})[key];
  if(!g) return '';
  return `<div style="margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
    <span class="small-muted" style="font-size:.7rem;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(g.filename)}">${escapeHtml(g.filename)}</span>
    <button class="btn btn-outline btn-sm" data-verguia="${key}" style="padding:3px 8px;font-size:.7rem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg> Ver</button>
    <button class="btn btn-outline btn-sm" data-baixarguia="${key}" style="padding:3px 8px;font-size:.7rem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg> Baixar</button>
    <button class="btn btn-danger btn-sm" data-removerguia="${key}" style="padding:3px 8px;font-size:.7rem">Remover</button>
  </div>`;
}

export function bindGuiaButtons(box, c, onRemoved){
  box.querySelectorAll('[data-verguia]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    verGuia((c.impostosGuias || {})[btn.dataset.verguia]);
  }));
  box.querySelectorAll('[data-baixarguia]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadGuia(c, btn.dataset.baixarguia);
  }));
  box.querySelectorAll('[data-removerguia]').forEach(btn => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await removerGuia(c, btn.dataset.removerguia);
    if(onRemoved) onRemoved();
  }));
}
