import { $ } from './utils.js';
import { loadData } from './state.js';
import { getSession, initAuthForm, showApp, showLogin } from './auth.js';
import { initModals } from './modal.js';
import { render } from './companies.js';

// importados pelo efeito colateral: ligam os listeners dos botões/formulários de cada tela
import './apuracao.js';
import './perfil.js';
import './guias.js';
import './impostosCustom.js';
import './historico.js';
import './backup.js';

initModals();

/* ---------------- dark mode ---------------- */
$('#btnDark').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  $('#btnDark').innerHTML = document.body.classList.contains('dark') ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>` : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
});

/* ---------------- init ---------------- */
async function boot(session){
  showApp();
  await loadData();
  render();
}

initAuthForm(boot);

const session = await getSession();
if(session){ boot(session); } else { showLogin(); }
