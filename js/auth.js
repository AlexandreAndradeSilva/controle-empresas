/* Autenticação: sessão, entrar, criar conta (por convite), sair e alterar senha.
   O cadastro exige um código de convite de uso único. A checagem feita aqui é
   apenas para dar uma mensagem de erro decente — quem realmente barra é o
   trigger em auth.users (ver supabase/migration.sql), porque a anon key é
   pública e qualquer um poderia chamar signUp() direto pelo console. */
import { supabase } from './supabaseClient.js';
import { $, toast } from './utils.js';
import { openModal, closeModal } from './modal.js';

const SENHA_MINIMA = 8;

export async function getSession(){
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/* ---------------- mensagens de erro ---------------- */
function traduzErroLogin(error){
  const m = (error?.message || '').toLowerCase();
  if(m.includes('email not confirmed')) return 'Este e-mail ainda não foi confirmado.';
  return 'E-mail ou senha inválidos.';
}

function traduzErroCadastro(error){
  const m = (error?.message || '').toLowerCase();
  if(m.includes('already registered') || m.includes('already been registered')) return 'Este e-mail já possui uma conta. Use a aba Entrar.';
  if(m.includes('password')) return `A senha deve ter ao menos ${SENHA_MINIMA} caracteres.`;
  if(m.includes('invalid') && m.includes('email')) return 'E-mail inválido.';
  /* O trigger do banco aborta o insert e o GoTrue devolve um erro genérico de
     banco de dados — o caso mais provável é o convite ter sido usado entre a
     validação e o cadastro. */
  return 'Não foi possível criar a conta. Confira o código de convite e tente novamente.';
}

function mostraErro(sel, msg, sucesso = false){
  const el = $(sel);
  if(!el) return;
  el.textContent = msg || '';
  el.classList.toggle('is-ok', !!msg && sucesso);
}

/* ---------------- abas ---------------- */
function ativaAba(qual){
  const login = qual === 'login';
  const tabL = $('#tabLogin'), tabS = $('#tabSignup');
  if(tabL){ tabL.classList.toggle('active', login); tabL.setAttribute('aria-selected', String(login)); }
  if(tabS){ tabS.classList.toggle('active', !login); tabS.setAttribute('aria-selected', String(!login)); }
  $('#loginForm').style.display = login ? '' : 'none';
  $('#signupForm').style.display = login ? 'none' : '';
  mostraErro('#loginError', '');
  mostraErro('#signupError', '');
}

/* ---------------- init ---------------- */
export function initAuthForm(onLoggedIn){
  $('#tabLogin')?.addEventListener('click', () => ativaAba('login'));
  $('#tabSignup')?.addEventListener('click', () => ativaAba('signup'));

  /* ----- entrar ----- */
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#loginEmail').value.trim();
    const password = $('#loginPassword').value;
    const btn = $('#btnLogin');
    mostraErro('#loginError', '');
    btn.disabled = true;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    btn.disabled = false;
    if(error){ mostraErro('#loginError', traduzErroLogin(error)); return; }
    onLoggedIn(data.session);
  });

  /* ----- criar conta ----- */
  $('#signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#signupEmail').value.trim();
    const password = $('#signupPassword').value;
    const password2 = $('#signupPassword2').value;
    const code = $('#signupInvite').value.trim();
    const btn = $('#btnSignup');
    mostraErro('#signupError', '');

    if(password.length < SENHA_MINIMA){
      mostraErro('#signupError', `A senha deve ter ao menos ${SENHA_MINIMA} caracteres.`);
      return;
    }
    if(password !== password2){
      mostraErro('#signupError', 'As duas senhas não conferem.');
      return;
    }
    if(!code){
      mostraErro('#signupError', 'Informe o código de convite.');
      return;
    }

    btn.disabled = true;

    /* cortesia: erro claro antes de tentar criar a conta */
    const { data: disponivel, error: rpcError } = await supabase.rpc('invite_disponivel', { p_code: code });
    if(rpcError){
      btn.disabled = false;
      mostraErro('#signupError', 'Não foi possível validar o convite agora. Tente novamente.');
      return;
    }
    if(!disponivel){
      btn.disabled = false;
      mostraErro('#signupError', 'Código de convite inválido ou já utilizado.');
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { invite_code: code } }
    });
    btn.disabled = false;

    if(error){ mostraErro('#signupError', traduzErroCadastro(error)); return; }

    /* Com "Confirm email" desligado no Supabase, signUp já devolve sessão e o
       usuário entra direto. Se estiver ligado, não há sessão e ele precisa
       confirmar o e-mail antes. */
    if(data.session){ onLoggedIn(data.session); return; }
    mostraErro('#signupError', 'Conta criada. Confirme o e-mail enviado para você e depois entre pela aba Entrar.', true);
  });

  /* ----- sair ----- */
  $('#btnLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.reload();
  });

  /* ----- alterar senha ----- */
  $('#btnAlterarSenha')?.addEventListener('click', () => {
    $('#novaSenha').value = '';
    $('#novaSenha2').value = '';
    mostraErro('#senhaError', '');
    openModal('#modalSenha');
  });

  $('#formSenha')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const senha = $('#novaSenha').value;
    const senha2 = $('#novaSenha2').value;
    const btn = $('#btnSalvarSenha');
    mostraErro('#senhaError', '');

    if(senha.length < SENHA_MINIMA){
      mostraErro('#senhaError', `A senha deve ter ao menos ${SENHA_MINIMA} caracteres.`);
      return;
    }
    if(senha !== senha2){
      mostraErro('#senhaError', 'As duas senhas não conferem.');
      return;
    }

    btn.disabled = true;
    const { error } = await supabase.auth.updateUser({ password: senha });
    btn.disabled = false;

    if(error){
      const m = (error.message || '').toLowerCase();
      if(m.includes('session') || m.includes('jwt')){
        mostraErro('#senhaError', 'Sua sessão expirou. Entre novamente.');
        return;
      }
      mostraErro('#senhaError', 'Não foi possível alterar a senha.');
      return;
    }
    closeModal('#modalSenha');
    toast('Senha alterada.');
  });

  ativaAba('login');
}

export function showApp(){
  $('#loginScreen').style.display = 'none';
  $('#appRoot').style.display = '';
}

export function showLogin(){
  $('#loginScreen').style.display = '';
  $('#appRoot').style.display = 'none';
}
