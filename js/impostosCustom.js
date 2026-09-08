import { $, $$, toast, escapeHtml } from './utils.js';
import { DATA, saveData } from './state.js';
import { openModal, confirmDialog } from './modal.js';
import { IMPOSTOS_SISTEMA, impostoSistemaAtivoGlobal } from './fields.js';

const REGIME_LABEL = { 'SIMPLES NACIONAL':'Simples Nacional', 'LUCRO PRESUMIDO':'Lucro Presumido', 'LUCRO REAL':'Lucro Real' };
const REGIME_ORDER = ['SIMPLES NACIONAL','LUCRO PRESUMIDO','LUCRO REAL'];

export function renderImpostosCustomList(){
  const box = $('#impostosCustomList');
  const list = DATA.impostosCustom || [];
  if(list.length === 0){
    box.innerHTML = `<div class="empty">Nenhum imposto adicional cadastrado ainda.</div>`;
    return;
  }
  const itemRow = (f, idx) => `
    <div class="client-row" style="cursor:default">
      <div class="client-main">
        <div class="avatar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/></svg></div>
        <div style="min-width:0"><div class="client-name">${escapeHtml(f.label)}</div></div>
      </div>
      <button class="btn btn-danger btn-sm" data-delimposto="${idx}">Remover</button>
    </div>`;

  let sections = '';
  REGIME_ORDER.forEach(regime => {
    const itens = list.map((f,idx)=>({f,idx})).filter(({f}) => (f.regimes||[]).includes(regime));
    if(itens.length === 0) return;
    sections += `<div class="doc-group-title">${REGIME_LABEL[regime]}</div>`;
    sections += itens.map(({f,idx}) => itemRow(f, idx)).join('');
  });
  box.innerHTML = sections ? `<div class="form-card">${sections}</div>` : `<div class="empty">Nenhum imposto adicional cadastrado ainda.</div>`;

  $$('#impostosCustomList [data-delimposto]').forEach(btn => btn.addEventListener('click', async () => {
    try{
      const idx = parseInt(btn.dataset.delimposto);
      const item = list[idx];
      if(!item) return;
      const ok2go = await confirmDialog(`Remover o imposto "${item.label}"? Ele deixará de aparecer na Apuração das empresas do regime configurado.`, {okLabel:'Remover'});
      if(!ok2go) return;
      const removed = DATA.impostosCustom.splice(idx,1)[0];
      const ok = await saveData();
      if(!ok){
        DATA.impostosCustom.splice(idx,0,removed); // desfaz se não salvou
        toast('Não foi possível remover — tente novamente.');
        return;
      }
      renderImpostosCustomList();
      toast('Imposto removido.');
    }catch(err){
      console.error('Erro ao remover imposto customizado:', err);
      toast('Erro ao remover: ' + (err && err.message ? err.message : err));
    }
  }));
}

export function renderImpostosSistemaList(){
  const box = $('#impostosSistemaList');
  const itemRow = (item) => {
    const ativo = impostoSistemaAtivoGlobal(item.key);
    return `
    <div class="client-row" style="cursor:default">
      <div class="client-main">
        <div class="avatar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/></svg></div>
        <div style="min-width:0"><div class="client-name">${escapeHtml(item.label)}</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="small-muted" style="font-size:.75rem;font-weight:700">${ativo?'Ativo':'Inativo'}</span>
        <label class="toggle-switch">
          <input type="checkbox" data-toggleimpsistema="${item.key}" ${ativo?'checked':''}>
          <span class="slider"></span>
        </label>
      </div>
    </div>`;
  };

  let sections = '';
  REGIME_ORDER.forEach(regime => {
    const itens = IMPOSTOS_SISTEMA.filter(item => item.regimes.includes(regime));
    if(itens.length === 0) return;
    sections += `<div class="doc-group-title">${REGIME_LABEL[regime]}</div>`;
    sections += itens.map(itemRow).join('');
  });
  box.innerHTML = `<div class="form-card">${sections}</div>`;

  $$('#impostosSistemaList [data-toggleimpsistema]').forEach(input => input.addEventListener('change', async (e) => {
    const key = input.dataset.toggleimpsistema;
    DATA.impostosSistemaDesativados = DATA.impostosSistemaDesativados || [];
    if(input.checked){
      DATA.impostosSistemaDesativados = DATA.impostosSistemaDesativados.filter(k => k !== key);
    } else {
      if(!DATA.impostosSistemaDesativados.includes(key)) DATA.impostosSistemaDesativados.push(key);
    }
    const ok = await saveData();
    if(!ok){ toast('Não foi possível salvar — tente novamente.'); return; }
    renderImpostosSistemaList();
    const item = IMPOSTOS_SISTEMA.find(i => i.key === key);
    toast(input.checked ? `"${item.label}" ativado pra todo mundo.` : `"${item.label}" desativado pra todo mundo (dá pra reativar só pra um cliente específico no perfil dele).`);
  }));
}

$('#btnGerenciarImpostos').addEventListener('click', () => {
  renderImpostosSistemaList();
  renderImpostosCustomList();
  openModal('#modalGerenciarImpostos');
});

$$('.novoImpostoRegime').forEach(cb => {
  cb.addEventListener('change', () => {
    const chip = cb.closest('.regime-chip');
    if(chip) chip.classList.toggle('checked', cb.checked);
  });
});

$('#btnAddImpostoCustom').addEventListener('click', async () => {
  try{
    const nome = $('#novoImpostoNome').value.trim();
    const regimes = $$('.novoImpostoRegime:checked').map(el => el.value);
    if(!nome){ toast('Informe o nome do imposto.'); return; }
    if(regimes.length === 0){ toast('Selecione ao menos um regime.'); return; }

    const btn = $('#btnAddImpostoCustom');
    btn.disabled = true;
    const novoItem = {
      key: 'custom_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      label: nome,
      regimes
    };
    DATA.impostosCustom = DATA.impostosCustom || [];
    DATA.impostosCustom.push(novoItem);

    const ok = await saveData();
    btn.disabled = false;

    if(!ok){
      // desfaz a alteração local já que não foi salva — evita duplicar em nova tentativa
      DATA.impostosCustom = DATA.impostosCustom.filter(f => f.key !== novoItem.key);
      toast('Não foi possível adicionar o imposto — tente novamente.');
      return;
    }

    $('#novoImpostoNome').value = '';
    $$('.novoImpostoRegime').forEach(el => { el.checked = false; const chip = el.closest('.regime-chip'); if(chip) chip.classList.remove('checked'); });
    renderImpostosCustomList();
    toast('Imposto adicionado — já aparece na Apuração das empresas desse regime.');
  }catch(err){
    console.error('Erro ao adicionar imposto customizado:', err);
    $('#btnAddImpostoCustom').disabled = false;
    toast('Erro ao adicionar: ' + (err && err.message ? err.message : err));
  }
});
