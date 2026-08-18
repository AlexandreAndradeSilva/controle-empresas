import { supabase } from './supabaseClient.js';

/* ---------------- state ---------------- */
export let DATA = { companies: [] };
export let currentProfileId = null;
export let perfilReturnTo = null;

export function setCurrentProfileId(id){ currentProfileId = id; }
export function setPerfilReturnTo(v){ perfilReturnTo = v; }
export function setData(newData){ DATA = newData; }

let ownerId = null;
export function getOwnerId(){ return ownerId; }

/* ---------------- mapeamento companies (linha do Supabase <-> objeto usado no app) ---------------- */
function rowToCompany(row){
  return {
    id: row.id,
    numero: row.numero || '',
    razaoSocial: row.razao_social,
    cnpj: row.cnpj || '',
    ie: row.ie || '',
    atividade: row.atividade || '',
    municipio: row.municipio || '',
    uf: row.uf || '',
    dificuldade: row.dificuldade || 'FACIL',
    responsaveis: row.responsaveis || '',
    regime: row.regime || '',
    status: row.status || 'PENDENTE',
    vencimento: row.vencimento || '',
    baixada: !!row.baixada,
    motivoBaixa: row.motivo_baixa || '',
    dataBaixa: row.data_baixa || '',
    situacaoDocumentos: row.situacao_documentos || '',
    responsavelEmpresa: row.responsavel_empresa || {},
    senhas: row.senhas || {},
    documentos: row.documentos || {},
    documentosPadrao: row.documentos_padrao || {},
    declaracao: row.declaracao || {},
    declaracaoPadrao: row.declaracao_padrao || {},
    impostos: row.impostos || {},
    impostosPadrao: row.impostos_padrao || {},
    impostosValores: row.impostos_valores || {},
    impostosGuias: row.impostos_guias || {},
    historico: row.historico || [],
    observacoes: row.observacoes || '',
    observacoesApuracao: row.observacoes_apuracao || ''
  };
}

function companyToRow(c){
  return {
    id: c.id,
    owner_id: ownerId,
    numero: c.numero || '',
    razao_social: c.razaoSocial,
    cnpj: c.cnpj || '',
    ie: c.ie || '',
    atividade: c.atividade || '',
    municipio: c.municipio || '',
    uf: c.uf || '',
    dificuldade: c.dificuldade || 'FACIL',
    responsaveis: c.responsaveis || '',
    regime: c.regime || '',
    status: c.status || 'PENDENTE',
    vencimento: c.vencimento || null,
    baixada: !!c.baixada,
    motivo_baixa: c.motivoBaixa || '',
    data_baixa: c.dataBaixa || null,
    situacao_documentos: c.situacaoDocumentos || '',
    responsavel_empresa: c.responsavelEmpresa || {},
    senhas: c.senhas || {},
    documentos: c.documentos || {},
    documentos_padrao: c.documentosPadrao || {},
    declaracao: c.declaracao || {},
    declaracao_padrao: c.declaracaoPadrao || {},
    impostos: c.impostos || {},
    impostos_padrao: c.impostosPadrao || {},
    impostos_valores: c.impostosValores || {},
    impostos_guias: c.impostosGuias || {},
    historico: c.historico || [],
    observacoes: c.observacoes || '',
    observacoes_apuracao: c.observacoesApuracao || ''
  };
}

/* ---------------- carregar / salvar tudo (mantém a mesma semântica de "salva o estado inteiro" do app original) ---------------- */
export async function loadData(){
  const { data: { user } } = await supabase.auth.getUser();
  ownerId = user.id;

  const [{ data: companyRows }, { data: impostosRows }, { data: settingsRow }] = await Promise.all([
    supabase.from('companies').select('*').eq('owner_id', ownerId),
    supabase.from('impostos_custom').select('*').eq('owner_id', ownerId).order('position', { ascending: true }),
    supabase.from('user_settings').select('*').eq('owner_id', ownerId).maybeSingle()
  ]);

  DATA = {
    companies: (companyRows || []).map(rowToCompany),
    impostosCustom: (impostosRows || []).map(r => ({ key: r.key, label: r.label, regimes: r.regimes || [] })),
    ordemApuracaoManual: (settingsRow && settingsRow.ordem_apuracao_manual) || []
  };
}

async function persist(){
  const companyRows = DATA.companies.map(companyToRow);
  const currentIds = DATA.companies.map(c => c.id);

  const { data: existing } = await supabase.from('companies').select('id').eq('owner_id', ownerId);
  const toDelete = (existing || []).map(r => r.id).filter(id => !currentIds.includes(id));
  if(toDelete.length) await supabase.from('companies').delete().in('id', toDelete);
  if(companyRows.length) {
    const { error } = await supabase.from('companies').upsert(companyRows);
    if(error) throw error;
  }

  const impostosCustom = DATA.impostosCustom || [];
  const impostosRows = impostosCustom.map((f, idx) => ({ key: f.key, owner_id: ownerId, label: f.label, regimes: f.regimes || [], position: idx }));
  const currentKeys = impostosCustom.map(f => f.key);
  const { data: existingImpostos } = await supabase.from('impostos_custom').select('key').eq('owner_id', ownerId);
  const impostosToDelete = (existingImpostos || []).map(r => r.key).filter(k => !currentKeys.includes(k));
  if(impostosToDelete.length) await supabase.from('impostos_custom').delete().in('key', impostosToDelete);
  if(impostosRows.length){
    const { error } = await supabase.from('impostos_custom').upsert(impostosRows);
    if(error) throw error;
  }

  const { error: settingsError } = await supabase.from('user_settings')
    .upsert({ owner_id: ownerId, ordem_apuracao_manual: DATA.ordemApuracaoManual || [] });
  if(settingsError) throw settingsError;
}

export async function saveData(){
  try{
    await persist();
    return true;
  }catch(e){
    console.error('Falha ao salvar, tentando novamente...', e);
    try{
      await new Promise(r => setTimeout(r, 700));
      await persist();
      return true;
    }catch(e2){
      console.error(e2);
      const { toast } = await import('./utils.js');
      toast('Não foi possível salvar os dados. Tente novamente em instantes.');
      return false;
    }
  }
}
