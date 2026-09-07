import { statusLabel, fmtDate, fmtMoney, formatTempo, monthLabelPT, sanitizeFileName } from './utils.js';
import { DOC_FIELDS, getImpostosFieldsForCompany, getDeclaracaoFieldsForCompany,
         getObrigacoesFieldsForCompany, REINF_TIPOS, isReinfLabel } from './fields.js';
import { getResponsaveisArray, getSistemasArray } from './companies.js';

export { monthLabelPT, sanitizeFileName };

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

  const listaResp = getResponsaveisArray(c).filter(r => r.nome || r.telefone || r.email || r.outros);
  if(listaResp.length){
    sectionTitle('Responsável pela empresa');
    listaResp.forEach((resp, idx) => {
      if(idx > 0) y += 2;
      if(resp.nome) line(listaResp.length>1?`Nome (${idx+1})`:'Nome', resp.nome);
      if(resp.telefone) line('Telefone', resp.telefone);
      if(resp.email) line('E-mail', resp.email);
      if(resp.outros) line('Outros', resp.outros);
    });
    y += 3;
  }

  const s = c.senhas || {};
  const hasSenha = (o) => o && (o.nome || o.login || o.senha);
  const listaSistemas = getSistemasArray(c).filter(hasSenha);
  if(hasSenha(s.prefeitura) || listaSistemas.length){
    sectionTitle('Senhas');
    if(hasSenha(s.prefeitura)){ line('Prefeitura — Login', s.prefeitura.login); line('Prefeitura — Senha', s.prefeitura.senha); }
    listaSistemas.forEach((sis, idx) => {
      const nome = sis.nome || `Sistema ${idx+1}`;
      line(nome+' — Login', sis.login);
      line(nome+' — Senha', sis.senha);
    });
    y += 3;
  }

  sectionTitle('Declaração');
  getDeclaracaoFieldsForCompany(c).forEach(([k,lbl,,def]) => line(lbl, (snap.declaracao && snap.declaracao[k]) || def));
  y += 3;

  const obrigFields = getObrigacoesFieldsForCompany(c);
  if(obrigFields.length){
    sectionTitle('Obrigações');
    obrigFields.forEach(([k,lbl,,def]) => {
      const valor = k === 'dctfWeb' ? ((snap.declaracao && snap.declaracao[k]) || def) : ((snap.obrigacoes && snap.obrigacoes[k]) || def);
      line(lbl, valor);
    });
    y += 3;
  }

  sectionTitle('Apuração');
  DOC_FIELDS.forEach(([k,lbl,,def]) => line(lbl, (snap.documentos && snap.documentos[k]) || def));
  y += 3;

  sectionTitle('Impostos');
  getImpostosFieldsForCompany(c).forEach(([k,lbl,,def]) => {
    const status = (snap.impostos && snap.impostos[k]) || def;
    const money = fmtMoney(snap.impostosValores && snap.impostosValores[k]);
    const venc = snap.impostosVencimentos && snap.impostosVencimentos[k];
    let texto = money ? `${status} — ${money}` : status;
    if(venc) texto += ` (vence ${fmtDate(venc)})`;
    if(isReinfLabel(lbl)){
      const tipos = (snap.impostosReinfTipos && snap.impostosReinfTipos[k]) || {};
      const nomes = REINF_TIPOS.filter(([tk]) => tipos[tk]).map(([,tl]) => tl);
      if(nomes.length) texto += ` [${nomes.join(', ')}]`;
    }
    line(lbl, texto);
  });

  if(snap.tempoApuracaoSegundos){
    y += 3;
    line('Tempo de apuração', formatTempo(snap.tempoApuracaoSegundos));
  }

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
