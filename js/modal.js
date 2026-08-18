import { $, $$ } from './utils.js';

export function openModal(id){ $(id).classList.add('show'); }
export function closeModal(id){ $(id).classList.remove('show'); }

export function initModals(){
  $$('[data-close]').forEach(btn => btn.addEventListener('click', (e) => closeModal('#'+e.target.closest('.overlay').id)));
  $$('.overlay').forEach(ov => ov.addEventListener('click', (e) => { if(e.target===ov) closeModal('#'+ov.id); }));
}
