import { supabase } from './supabaseClient.js';

const $ = (sel) => document.querySelector(sel);

export async function getSession(){
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function initAuthForm(onLoggedIn){
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#loginEmail').value.trim();
    const password = $('#loginPassword').value;
    const btn = $('#btnLogin');
    $('#loginError').textContent = '';
    btn.disabled = true;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    btn.disabled = false;
    if(error){
      $('#loginError').textContent = 'E-mail ou senha inválidos.';
      return;
    }
    onLoggedIn(data.session);
  });

  $('#btnLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.reload();
  });
}

export function showApp(){
  $('#loginScreen').style.display = 'none';
  $('#appRoot').style.display = '';
}

export function showLogin(){
  $('#loginScreen').style.display = 'flex';
  $('#appRoot').style.display = 'none';
}
