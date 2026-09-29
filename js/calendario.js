/* Calendario de vencimentos: monta o mes a partir das datas preenchidas na tela
   de Impostos de cada empresa, mais o lembrete recorrente da Guia ISS. */
import { $, $$, toast, escapeHtml, fmtDate, pad2, isoDate, mesKeyDe, MESES_PT } from './utils.js';
import { DATA, saveData } from './state.js';
import { openModal, closeModal } from './modal.js';
import { getImpostosFieldsForCompany } from './fields.js';
import { render, openEditFromList } from './companies.js';
import { openImpostoDetalheView } from './historico.js';

export function setCalDate(d){ calDate = d; }

export let calDate = new Date();
let calEmpresaFiltro = '';

// mapa 'AAAA-MM-DD' -> lista de { company, key, label } com base no vencimento
// que foi preenchido na tela de Impostos de cada empresa
// "Enviado" é uma marcação independente (só pra guiar o calendário) — nunca
// escreve no status real do imposto. Todo imposto começa como "Não" por
// padrão; só vira "Sim" quando marcado manualmente aqui.
export function impostoEnviadoEfetivo(c, key){
  const map = c.impostosEnviado || {};
  return !!map[key];
}

export function getVencimentosPorDia(){
  const map = {};
  const anoView = calDate.getFullYear();
  const mesView = calDate.getMonth();
  const diasNoMesView = new Date(anoView, mesView+1, 0).getDate();
  const mesKey = mesKeyDe(calDate);
  const mostrarArquivadas = $('#calMostrarArquivadas') && $('#calMostrarArquivadas').checked;
  DATA.companies.filter(c => {
    if(!c.baixada) return true;
    if(!mostrarArquivadas) return false;
    // só mostra os avisos de uma empresa arquivada no mês em que ela foi arquivada —
    // nos meses seguintes, mesmo com "Mostrar arquivadas" marcado, ela não aparece mais
    if(!c.dataBaixa) return false;
    const db = new Date(c.dataBaixa);
    return db.getFullYear() === anoView && db.getMonth() === mesView;
  }).filter(c => !calEmpresaFiltro || c.id === calEmpresaFiltro).forEach(c => {
    const venc = c.impostosVencimentos || {};
    const fields = getImpostosFieldsForCompany(c);
    Object.keys(venc).forEach(k => {
      const dateISO = venc[k];
      if(!dateISO) return;
      const field = fields.find(f => f[0] === k);
      const label = field ? field[1] : k;
      if(!map[dateISO]) map[dateISO] = [];
      map[dateISO].push({ company: c, key: k, label });
    });
    const dia = parseInt(c.diaVencimentoIss, 10);
    if(dia >= 1 && dia <= 31){
      const jaDispensado = (c.issDismissedMeses || {})[mesKey];
      if(!jaDispensado){
        const diaClamp = Math.min(dia, diasNoMesView);
        const dateISO = isoDate(anoView, mesView, diaClamp);
        if(!map[dateISO]) map[dateISO] = [];
        map[dateISO].push({ company: c, key: 'guiaIss', label: 'Guia ISS', especial: true, mesKey });
      }
    }
  });
  return map;
}

export function renderCalendario(){
  const y = calDate.getFullYear();
  const m = calDate.getMonth();
  $('#calMonthLabel').textContent = `${MESES_PT[m]} ${y}`;

  const map = getVencimentosPorDia();
  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();

  const cells = [];
  for(let i=firstWeekday; i>0; i--){
    const d = new Date(y, m, 1 - i);
    cells.push({ date: d, outside: true });
  }
  for(let d=1; d<=daysInMonth; d++){
    cells.push({ date: new Date(y, m, d), outside: false });
  }
  while(cells.length % 7 !== 0){
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), outside: true });
  }

  const hoje = new Date();
  const todayISO = isoDate(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  $('#calGrid').innerHTML = cells.map(cell => {
    const dateISO = isoDate(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate());
    const items = map[dateISO] || [];
    const isToday = dateISO === todayISO;
    const itemsHtml = items.map(it => {
      if(it.especial){
        const titulo = `${it.company.razaoSocial} — ${it.label}`;
        return `<div class="cal-item st-special" data-calspecial="${it.company.id}" data-calspecialmes="${it.mesKey}" title="${escapeHtml(titulo)} — clique pra marcar como resolvido esse mês">
          <span class="cal-item-check" style="border-style:dashed"></span>
          <span class="cal-item-text">
            <span class="cal-item-name">${escapeHtml(it.company.razaoSocial)}</span>
            <span class="cal-item-tax">${escapeHtml(it.label)}</span>
          </span>
        </div>`;
      }
      const enviado = impostoEnviadoEfetivo(it.company, it.key);
      const cls = enviado ? 'st-ok' : 'st-pend';
      const titulo = `${it.company.razaoSocial} — ${it.label}`;
      return `<div class="cal-item ${cls}" data-calview="${it.company.id}" data-calviewkey="${it.key}" title="${escapeHtml(titulo)}">
        <button type="button" class="cal-item-check" data-calcheck="${it.company.id}" data-calcheckkey="${it.key}" title="${enviado ? 'Marcar como não enviado' : 'Marcar como enviado'}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </button>
        <span class="cal-item-text">
          <span class="cal-item-name">${escapeHtml(it.company.razaoSocial)}</span>
          <span class="cal-item-tax">${escapeHtml(it.label)}</span>
        </span>
        <button type="button" class="cal-item-eye" data-caleye="${it.company.id}" data-caleyekey="${it.key}" title="Ver detalhes">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>`;
    }).join('');
    return `<div class="cal-day ${cell.outside?'outside':''} ${isToday?'today':''}">
      <div class="cal-daynum">${cell.date.getDate()}</div>
      ${itemsHtml}
    </div>`;
  }).join('');

  $$('#calGrid [data-calcheck]').forEach(btn => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await toggleImpostoEnviadoCalendario(btn.dataset.calcheck, btn.dataset.calcheckkey);
  }));
  $$('#calGrid [data-calview]').forEach(el => el.addEventListener('click', () => {
    const c = DATA.companies.find(x => x.id === el.dataset.calview);
    if(c) openImpostoDetalheView(c, el.dataset.calviewkey);
  }));
  $$('#calGrid [data-calspecial]').forEach(el => el.addEventListener('click', async () => {
    await dismissIssReminder(el.dataset.calspecial, el.dataset.calspecialmes);
  }));
  $$('#calGrid [data-caleye]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const c = DATA.companies.find(x => x.id === btn.dataset.caleye);
    if(!c) return;
    if(btn.dataset.caleyekey === '__especial__'){
      closeModal('#modalCalendario');
      openEditFromList(c.id);
    } else {
      openImpostoDetalheView(c, btn.dataset.caleyekey);
    }
  }));
}

export async function dismissIssReminder(companyId, mesKey){
  const c = DATA.companies.find(x => x.id === companyId);
  if(!c) return;
  c.issDismissedMeses = c.issDismissedMeses || {};
  c.issDismissedMeses[mesKey] = true;
  await saveData();
  renderCalendario();
  render();
  toast('Lembrete da Guia ISS resolvido esse mês — volta a aparecer no mês que vem.');
}

export async function toggleImpostoEnviadoCalendario(companyId, key){
  const c = DATA.companies.find(x => x.id === companyId);
  if(!c) return;
  const atual = impostoEnviadoEfetivo(c, key);
  c.impostosEnviado = c.impostosEnviado || {};
  c.impostosEnviado[key] = !atual;
  await saveData();
  toast(!atual ? 'Marcado como enviado.' : 'Marcado como não enviado.');
  renderCalendario();
  render();
}

export function populateCalEmpresaFiltro(){
  const dl = $('#calEmpresaDatalist');
  const mostrarArquivadas = $('#calMostrarArquivadas').checked;
  const empresas = DATA.companies.filter(c => mostrarArquivadas || !c.baixada).slice().sort((a,b)=>a.razaoSocial.localeCompare(b.razaoSocial));
  dl.innerHTML = empresas.map(c => `<option value="${escapeHtml(c.razaoSocial)}">`).join('');
}

$('#btnCalendarioVencimentos').addEventListener('click', () => {
  calDate = new Date();
  calEmpresaFiltro = '';
  $('#calMostrarArquivadas').checked = false;
  populateCalEmpresaFiltro();
  $('#calEmpresaFiltro').value = '';
  renderCalendario();
  openModal('#modalCalendario');
});
$('#calMostrarArquivadas').addEventListener('change', () => { populateCalEmpresaFiltro(); renderCalendario(); });
$('#calEmpresaFiltro').addEventListener('input', (e) => {
  const texto = e.target.value.trim().toLowerCase();
  if(!texto){ calEmpresaFiltro = ''; renderCalendario(); return; }
  const mostrarArquivadas = $('#calMostrarArquivadas').checked;
  const encontrada = DATA.companies.find(c => (mostrarArquivadas || !c.baixada) && c.razaoSocial.trim().toLowerCase() === texto);
  calEmpresaFiltro = encontrada ? encontrada.id : calEmpresaFiltro;
  renderCalendario();
});
$('#calRestaurarIss').addEventListener('click', async () => {
  const mesKey = mesKeyDe(calDate);
  let restaurados = 0;
  DATA.companies.forEach(c => {
    if(c.issDismissedMeses && c.issDismissedMeses[mesKey]){
      delete c.issDismissedMeses[mesKey];
      restaurados++;
    }
  });
  if(restaurados === 0){ toast('Nenhum aviso de ISS foi dispensado nesse mês.'); return; }
  await saveData();
  renderCalendario();
  render();
  toast(restaurados === 1 ? 'Um aviso de Guia ISS foi restaurado nesse mês.' : `${restaurados} avisos de Guia ISS foram restaurados nesse mês.`);
});
$('#calPrev').addEventListener('click', () => {
  calDate = new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1);
  renderCalendario();
});
$('#calNext').addEventListener('click', () => {
  calDate = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1);
  renderCalendario();
});
$('#calHoje').addEventListener('click', () => {
  calDate = new Date();
  renderCalendario();
});
