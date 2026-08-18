import { statusLabel, fmtDate, fmtMoney } from './utils.js';
import { DOC_FIELDS, DECLARACAO_FIELDS, getImpostosFieldsForCompany } from './fields.js';

export function monthLabelPT(date){
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return meses[date.getMonth()] + '/' + date.getFullYear();
}

export function sanitizeFileName(name){
  return (name||'empresa').replace(/[\\/:*?"<>|]/g,'-').trim().slice(0,80);
}

export function buildCompanyPdfBlob(c, snap, label){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 18;

  function sectionTitle(t){
    if(y > 265){ doc.addPage(); y = 18; }
    doc.setFontSize(12); doc.setTextColor(20,50,90);
    doc.text(t, 12, y); y += 6;
    doc.setDrawColor(210); doc.line(12, y-4.5, 198, y-4.5);
    doc.setFontSize(10); doc.setTextColor(20);
  }
  function line(label, value){
    if(y > 280){ doc.addPage(); y = 18; }
    doc.text(`${label}:`, 14, y);
    doc.text(String(value == null || value === '' ? '—' : value), 75, y);
    y += 6;
  }

  doc.setFontSize(15);
  doc.text(c.razaoSocial || 'Empresa', 12, y); y += 7;
  doc.setFontSize(10); doc.setTextColor(90);
  doc.text(`${c.municipio||''}${c.uf?'/'+c.uf:''}`, 12, y); y += 5;
  doc.text(`Apuração encerrada: ${label}`, 12, y); y += 10;
  doc.setTextColor(20);

  sectionTitle('Identificação');
  line('Nº (código interno)', c.numero);
  line('CNPJ / CPF', c.cnpj);
  line('IE', c.ie);
  line('Regime', c.regime);
  line('Atividade', c.atividade);
  line('Dificuldade', c.dificuldade);
  y += 3;

  sectionTitle('Situação');
  line('Status', statusLabel(c.status));
  line('Vencimento/Certificado', fmtDate(c.vencimento));
  y += 3;

  const resp = c.responsavelEmpresa || {};
  if(resp.nome || resp.telefone || resp.email || resp.outros){
    sectionTitle('Responsável pela empresa');
    if(resp.nome) line('Nome', resp.nome);
    if(resp.telefone) line('Telefone', resp.telefone);
    if(resp.email) line('E-mail', resp.email);
    if(resp.outros) line('Outros', resp.outros);
    y += 3;
  }

  const s = c.senhas || {};
  const hasSenha = (o) => o && (o.nome || o.login || o.senha);
  if(hasSenha(s.prefeitura) || hasSenha(s.sistema1) || hasSenha(s.sistema2)){
    sectionTitle('Senhas');
    if(hasSenha(s.prefeitura)){ line('Prefeitura — Login', s.prefeitura.login); line('Prefeitura — Senha', s.prefeitura.senha); }
    if(hasSenha(s.sistema1)){ line((s.sistema1.nome||'Sistema 1')+' — Login', s.sistema1.login); line((s.sistema1.nome||'Sistema 1')+' — Senha', s.sistema1.senha); }
    if(hasSenha(s.sistema2)){ line((s.sistema2.nome||'Sistema 2')+' — Login', s.sistema2.login); line((s.sistema2.nome||'Sistema 2')+' — Senha', s.sistema2.senha); }
    y += 3;
  }

  sectionTitle('Declaração');
  DECLARACAO_FIELDS.forEach(([k,lbl,,def]) => line(lbl, (snap.declaracao && snap.declaracao[k]) || def));
  y += 3;

  sectionTitle('Apuração');
  DOC_FIELDS.forEach(([k,lbl,,def]) => line(lbl, (snap.documentos && snap.documentos[k]) || def));
  y += 3;

  sectionTitle('Impostos');
  getImpostosFieldsForCompany(c).forEach(([k,lbl,,def]) => {
    const status = (snap.impostos && snap.impostos[k]) || def;
    const money = fmtMoney(snap.impostosValores && snap.impostosValores[k]);
    line(lbl, money ? `${status} — ${money}` : status);
  });

  if(c.observacoesApuracao){
    y += 3;
    sectionTitle('Observações');
    doc.setFontSize(9);
    const splitObsApur = doc.splitTextToSize(c.observacoesApuracao, 184);
    splitObsApur.forEach(t => { if(y>280){doc.addPage(); y=18;} doc.text(t,14,y); y+=5; });
    doc.setFontSize(10);
  }

  if(c.observacoes){
    y += 3;
    sectionTitle('Observações (importado do PDF)');
    doc.setFontSize(9);
    const splitObs = doc.splitTextToSize(c.observacoes, 184);
    splitObs.forEach(t => { if(y>280){doc.addPage(); y=18;} doc.text(t,14,y); y+=5; });
    doc.setFontSize(10);
  }

  return doc.output('blob');
}
