import { $, $$, toast, escapeHtml } from './utils.js';
import { DATA, saveData } from './state.js';
import { openModal } from './modal.js';

const REGIME_LABEL = { 'SIMPLES NACIONAL':'Simples Nacional', 'LUCRO PRESUMIDO':'Lucro Presumido', 'LUCRO REAL':'Lucro Real' };
const REGIME_ORDER = ['SIMPLES NACIONAL','LUCRO PRESUMIDO','LUCRO REAL'];

function renderImpostosCustomList(){
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

  let html = '';
  REGIME_ORDER.forEach(regime => {
    const itens = list.map((f,idx)=>({f,idx})).filter(({f}) => (f.regimes||[]).includes(regime));
    if(itens.length === 0) return;
    html += `<div class="section-title" style="margin-top:14px">${REGIME_LABEL[regime]}</div>`;
    html += itens.map(({f,idx}) => itemRow(f, idx)).join('');
  });
  box.innerHTML = html || `<div class="empty">Nenhum imposto adicional cadastrado ainda.</div>`;

  $$('#impostosCustomList [data-delimposto]').forEach(btn => btn.addEventListener('click', async () => {
    const idx = parseInt(btn.dataset.delimposto);
    const item = list[idx];
    if(!confirm(`Remover o imposto "${item.label}"? Ele deixará de aparecer na Apuração das empresas do regime configurado.`)) return;
    const removed = DATA.impostosCustom.splice(idx,1)[0];
    const ok = await saveData();
    if(!ok){
      DATA.impostosCustom.splice(idx,0,removed); // desfaz se não salvou
      toast('Não foi possível remover — tente novamente.');
      return;
    }
    renderImpostosCustomList();
    toast('Imposto removido.');
  }));
}

$('#btnGerenciarImpostos').addEventListener('click', () => {
  renderImpostosCustomList();
  openModal('#modalGerenciarImpostos');
});

$('#btnAddImpostoCustom').addEventListener('click', async () => {
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
  $$('.novoImpostoRegime').forEach(el => el.checked = false);
  renderImpostosCustomList();
  toast('Imposto adicionado — já aparece na Apuração das empresas desse regime.');
});
