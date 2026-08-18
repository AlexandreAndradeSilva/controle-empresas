import { supabase } from './supabaseClient.js';
import { $, toast, escapeHtml, moneyStrToNumber } from './utils.js';
import { DATA, saveData, getOwnerId, currentProfileId } from './state.js';
import { docsProgressPercent, statusFromProgress } from './fields.js';
import { openModal } from './modal.js';
import { render } from './companies.js';
import { renderImpostosSection } from './perfil.js';

const BUCKET = 'guias';

let guiaTargetKey = null;
let guiaTargetCompanyId = null;

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

$('#guiaFileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const c = DATA.companies.find(x => x.id === guiaTargetCompanyId);
  if(!guiaTargetKey || !c) return;

  // sincroniza tudo que está selecionado na tela agora (mesmo sem ter clicado em "Salvar")
  // pra não perder a escolha de Concluído ao recarregar a seção depois de anexar
  const impostosSecEl = document.getElementById('impostosSection');
  if(impostosSecEl){
    const novoImp = { ...(c.impostos||{}) };
    impostosSecEl.querySelectorAll('select[data-impkey]').forEach(sel => { novoImp[sel.dataset.impkey] = sel.value; });
    c.impostos = novoImp;
    const novoImpV = { ...(c.impostosValores||{}) };
    impostosSecEl.querySelectorAll('input[data-impvalue]').forEach(inp => { novoImpV[inp.dataset.impvalue] = moneyStrToNumber(inp.value); });
    c.impostosValores = novoImpV;
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
  const pct = docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao);
  c.status = statusFromProgress(pct);

  if(!file){
    // usuário cancelou o seletor de arquivo — ainda assim mantém o status marcado
    await saveData();
    render();
    if(impostosSecEl) renderImpostosSection(c, true);
    return;
  }
  if(file.type !== 'application/pdf'){
    toast('Selecione um arquivo em PDF. O status foi salvo mesmo assim.');
    await saveData();
    if(impostosSecEl) renderImpostosSection(c, true);
    return;
  }
  if(file.size > 3 * 1024 * 1024){
    toast('O PDF é muito grande (máximo 3MB). O status foi salvo, mas a guia não foi anexada.');
    await saveData();
    if(impostosSecEl) renderImpostosSection(c, true);
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
    if(impostosSecEl) renderImpostosSection(c, true);
    render();
  }catch(err){
    console.error(err);
    toast('Não foi possível anexar o arquivo.');
  }
});

async function signedUrlFor(g){
  if(!g) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(g.path, 3600);
  if(error){ console.error(error); return null; }
  return data.signedUrl;
}

export async function downloadGuia(c, key){
  const g = (c.impostosGuias || {})[key];
  if(!g) return;
  const url = await signedUrlFor(g);
  if(!url){ toast('Não foi possível baixar a guia.'); return; }
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = g.filename || 'guia.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function verGuia(g){
  if(!g) return;
  const url = await signedUrlFor(g);
  if(!url){ toast('Não foi possível abrir a guia.'); return; }
  $('#verGuiaTitulo').textContent = g.filename || 'Guia';
  $('#verGuiaFrame').src = url;
  $('#btnBaixarGuiaAberta').onclick = async () => {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = g.filename || 'guia.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  };
  openModal('#modalVerGuia');
}

export async function removerGuia(c, key){
  if(!confirm('Remover essa guia anexada?')) return;
  const g = (c.impostosGuias || {})[key];
  if(g && g.path){
    const { error } = await supabase.storage.from(BUCKET).remove([g.path]);
    if(error) console.error(error);
  }
  if(c.impostosGuias) delete c.impostosGuias[key];
  await saveData();
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
