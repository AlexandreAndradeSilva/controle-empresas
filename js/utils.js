export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => Array.from(document.querySelectorAll(sel));

export function debounce(fn, ms){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._h);
  toast._h = setTimeout(()=>t.classList.remove('show'), 2400);
}

export function uid(prefix){ return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
export function fmtDate(iso){ if(!iso) return '—'; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; }
export function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
export function initials(name){ return (name||'').trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join(''); }
export function statusLabel(s){ return {PENDENTE:'Pendente', ANDAMENTO:'Andamento', CONCLUIDA:'Concluída'}[s] || s; }

/* Aceita CPF (11 dígitos numéricos), CNPJ numérico (14 dígitos) e CNPJ alfanumérico
   (novo modelo da Receita Federal: 12 posições alfanuméricas + 2 dígitos verificadores numéricos) */
export function cleanDoc(v){
  return (v||'').toUpperCase().replace(/[^0-9A-Z]/g,'').slice(0,14);
}
export function maskDoc(raw){
  const v = cleanDoc(raw);
  if(v.length <= 11){
    // CPF: 000.000.000-00
    return v.replace(/^(\w{3})(\w{0,3})(\w{0,3})(\w{0,2})$/, (m,a,b,c,d) =>
      [a, b&&'.'+b, c&&'.'+c, d&&'-'+d].filter(Boolean).join(''));
  }
  // CNPJ (numérico ou alfanumérico): XX.XXX.XXX/XXXX-DD
  return v.replace(/^(\w{2})(\w{0,3})(\w{0,3})(\w{0,4})(\w{0,2})$/, (m,a,b,c,d,e) =>
    [a, b&&'.'+b, c&&'.'+c, d&&'/'+d, e&&'-'+e].filter(Boolean).join(''));
}
export function isValidDoc(v){
  const c = cleanDoc(v);
  return c.length === 0 || c.length === 11 || c.length === 14;
}
export function statusClass(s){ return s==='PENDENTE' ? 'status-late' : (s==='ANDAMENTO' ? 'status-mid' : 'status-ok'); }
export function statusColorKind(v){
  if(v === 'CONCLUIDO' || v === 'FEITO' || v === 'CLIENTE_ENVIOU' || v === 'RELATORIO_PREFEITURA' || v === 'MOVIMENTO ENCERRADO' || v === 'CREDOR') return 'ok';
  if(v === 'PENDENTE' || v === 'LANÇAR' || v === 'CONFERIR' || v === 'FECHAR DCTF') return 'late';
  if(!v) return '';
  if(v.includes('NÃO TEM') || v==='NÃO PAGA' || v==='NÃO PRECISA') return 'neutral';
  if(v==='SEM MOVIMENTO' || v==='CALCULAR' || v==='SOLICITADO') return 'mid';
  return '';
}
export function docPillClass(v){
  const kind = statusColorKind(v);
  return kind ? 'status-'+kind : '';
}
export function selectColorClass(v){
  const kind = statusColorKind(v);
  return kind ? 'sel-'+kind : '';
}
export function colorizeSelect(sel){
  sel.classList.remove('sel-ok','sel-late','sel-neutral','sel-mid');
  const cls = selectColorClass(sel.value);
  if(cls) sel.classList.add(cls);
}
export function colorizeSelectsIn(container){
  if(!container) return;
  container.querySelectorAll('select[data-dockey], select[data-impkey], select[data-deckey], select[data-padraokey], select[data-obrigkey], select[data-fatorrstatus]').forEach(colorizeSelect);
}
document.addEventListener('change', (e) => {
  if(e.target.matches && e.target.matches('select[data-dockey], select[data-impkey], select[data-deckey], select[data-padraokey]')){
    colorizeSelect(e.target);
  }
});

export function docField(label, value){
  return `<div><span class="small-muted">${label}</span><br><span class="status-pill ${docPillClass(value)}">${escapeHtml(value)}</span></div>`;
}
export function fmtMoney(v){
  const n = parseFloat(v);
  if(isNaN(n)) return null;
  return n.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
}
export function digitsToMoneyStr(digits){
  const n = parseInt(digits || '0', 10);
  let str = (n/100).toFixed(2);
  let [intPart, decPart] = str.split('.');
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return intPart + ',' + decPart;
}
export function moneyStrToNumber(str){
  const digits = (str||'').replace(/\D/g,'');
  if(!digits) return null;
  return parseInt(digits,10) / 100;
}
export function applyMoneyMask(input){
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g,'');
    input.value = digits ? digitsToMoneyStr(digits) : '';
  });
}
export function docFieldWithValue(label, statusValue, moneyValue){
  const money = fmtMoney(moneyValue);
  return `<div>
    ${label ? `<span class="small-muted">${label}</span><br>` : ''}
    <span class="status-pill ${docPillClass(statusValue)}">${escapeHtml(statusValue)}</span>
    ${money ? `<div style="margin-top:4px;font-size:.82rem;font-weight:700">${money}</div>` : ''}
  </div>`;
}

export async function copyValue(text, label){
  if(!text){ toast('Nada para copiar.'); return; }
  try{
    await navigator.clipboard.writeText(text);
    toast((label||'Valor')+' copiado!');
  }catch(e){
    toast('Não foi possível copiar.');
  }
}
export function copyableField(label, value){
  const v = escapeHtml(value)||'—';
  const hasValue = !!(value||'').trim();
  return `<div>
    <span class="small-muted">${label}</span><br>
    <span class="copy-field" ${hasValue?`data-copy="${v}" data-label="${label}"`:''} style="display:inline-flex;align-items:center;gap:6px;${hasValue?'cursor:pointer':''}">
      <strong>${v}</strong>${hasValue?'<span style="font-size:.8rem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>':''}
    </span>
  </div>`;
}

export function isVencendoEsteMes(vencimentoISO){
  if(!vencimentoISO) return false;
  const hoje = new Date();
  const [y,m] = vencimentoISO.split('-');
  return parseInt(y) === hoje.getFullYear() && parseInt(m) === (hoje.getMonth()+1);
}

/* Anima as barras de progresso do zero até o valor real, de forma confiável
   (em vez de depender de @keyframes com variável CSS, que trava em alguns navegadores). */
export function ativarAnimacaoBarras(container){
  if(!container) return;
  const barras = container.querySelectorAll('[data-bar-target]');
  const barrasV = container.querySelectorAll('[data-bar-target-h]');
  if(barras.length === 0 && barrasV.length === 0) return;
  barras.forEach(el => { el.style.width = '0%'; });
  barrasV.forEach(el => { el.style.height = '0%'; });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      barras.forEach(el => { el.style.width = el.dataset.barTarget; });
      barrasV.forEach(el => { el.style.height = el.dataset.barTargetH; });
    });
  });
}

/* ---------------- datas ---------------- */
export function pad2(n){ return String(n).padStart(2,'0'); }
export function isoDate(y,m,d){ return `${y}-${pad2(m+1)}-${pad2(d)}`; }
export const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
export function monthLabelPT(date){ return MESES_PT[date.getMonth()] + '/' + date.getFullYear(); }
export function mesKeyDe(date){ return `${date.getFullYear()}-${pad2(date.getMonth()+1)}`; }
export function mesKeyAtual(){ return mesKeyDe(new Date()); }

/* ---------------- tempo ---------------- */
export function formatTempo(totalSegundos){
  totalSegundos = Math.max(0, Math.floor(totalSegundos||0));
  const h = Math.floor(totalSegundos/3600);
  const m = Math.floor((totalSegundos%3600)/60);
  const s = totalSegundos%60;
  return [h,m,s].map(n => String(n).padStart(2,'0')).join(':');
}

/* ---------------- gráficos ---------------- */
export function lightenHex(hex, percent){
  hex = hex.replace('#','');
  if(hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
  const num = parseInt(hex, 16);
  const r = Math.min(255, (num >> 16) + Math.round(255 * percent));
  const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round(255 * percent));
  const b = Math.min(255, (num & 0x0000FF) + Math.round(255 * percent));
  return '#' + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
}
/* barra desenhada com caracteres, para as planilhas do Excel */
export function barraTexto(pct, largura){
  largura = largura || 20;
  const p = Math.max(0, Math.min(100, pct));
  const preenchido = Math.round(p/100*largura);
  return '█'.repeat(preenchido) + '░'.repeat(largura-preenchido) + ' ' + p.toFixed(1) + '%';
}

export function sanitizeFileName(name){
  return (name||'empresa').replace(/[\/:*?"<>|]/g,'-').trim().slice(0,80);
}

/* Recolore qualquer select de status assim que o valor muda, sem cada tela
   precisar reamarrar isso na mão. Chamado uma vez, no boot. */
export function initSelectColoring(){
  document.addEventListener('change', (e) => {
    if(e.target.matches && e.target.matches('select[data-dockey], select[data-impkey], select[data-deckey], select[data-padraokey], select[data-obrigkey], select[data-fatorrstatus]')){
      colorizeSelect(e.target);
    }
  });
}
