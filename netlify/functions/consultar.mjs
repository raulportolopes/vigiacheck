// Consulta real: Infosimples (CEAT - certidão eletrônica de ações trabalhistas, por TRT)
// + DataJud/CNJ (detalhes de cada processo pelo número).
// Atenção: a CEAT só lista ações movidas CONTRA a pessoa (polo passivo).
// Variáveis de ambiente no Netlify:
//   INFOSIMPLES_TOKEN  token da conta Infosimples
//   DATAJUD_API_KEY    opcional; chave pública do DataJud (o CNJ publica e às vezes troca)
//   SENHA_ACESSO       senha que o RH digita para usar o sistema
//   TRTS               lista de TRTs a consultar, ex.: "2,15" (padrão: 2,15)

// Chave pública divulgada pelo CNJ em https://datajud-wiki.cnj.jus.br/api-publica/acesso
const DATAJUD_CHAVE_PUBLICA = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

const CNJ_RE = /\d{7}-?\d{2}\.?\d{4}\.?5\.?\d{2}\.?\d{4}/g;

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8' },
});

function cpfValido(cpf) {
  const n = cpf.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
  for (const len of [9, 10]) {
    let s = 0;
    for (let i = 0; i < len; i++) s += +n[i] * (len + 1 - i);
    if ((s * 10) % 11 % 10 !== +n[len]) return false;
  }
  return true;
}

async function infosimplesCEAT(trt, cpf, token) {
  const url = `https://api.infosimples.com/api/v2/consultas/tribunal/trt${trt}/ceat-digital`;
  const body = new URLSearchParams({ token, cpf: cpf.replace(/\D/g, ''), timeout: '50' });
  // O Netlify encerra a função em cerca de 60 s, então cada certidão tem até 55 s.
  const r = await fetch(url, { method: 'POST', body, signal: AbortSignal.timeout(55000) });
  const data = await r.json().catch(() => ({}));
  const texto = JSON.stringify(data);
  const numeros = [...new Set((texto.match(CNJ_RE) || []).map(n => n.replace(/\D/g, '')))];
  return {
    trt,
    ok: data.code === 200 || data.code === 612,
    codigo: data.code,
    mensagem: data.code_message || '',
    nome: data.data?.[0]?.nome || null,
    negativa: data.data?.[0]?.nada_consta ?? data.data?.[0]?.conseguiu_emitir_certidao_negativa ?? null,
    total: data.data?.[0]?.total_processos ?? numeros.length,
    certidao_pdf: data.data?.[0]?.site_receipt || data.site_receipts?.[0] || null,
    numeros,
    custo: data.header?.price || null,
  };
}

async function datajud(numero, apiKey) {
  const trt = +numero.slice(14, 16);
  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_trt${trt}/_search`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `APIKey ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { match: { numeroProcesso: numero } } }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await r.json().catch(() => ({}));
  const s = data.hits?.hits?.[0]?._source;
  if (!s) return { numero, encontrado: false };
  const assuntos = (s.assuntos || []).flat().map(a => a?.nome).filter(Boolean);
  const movs = (s.movimentos || []).filter(m => m.dataHora)
    .sort((a, b) => b.dataHora.localeCompare(a.dataHora)).slice(0, 5)
    .map(m => ({ data: m.dataHora.slice(0, 10), nome: m.nome }));
  return {
    numero, encontrado: true,
    tribunal: s.tribunal, classe: s.classe?.nome, orgao: s.orgaoJulgador?.nome,
    ajuizamento: s.dataAjuizamento?.slice(0, 10), assuntos, movimentos: movs,
  };
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { erro: 'Use POST.' });
  const env = Netlify.env;
  const corpo = await req.json().catch(() => ({}));
  if (!env.get('SENHA_ACESSO') || corpo.senha !== env.get('SENHA_ACESSO')) return json(401, { erro: 'Senha de acesso incorreta.' });
  const cpf = String(corpo.cpf || '');
  if (!cpfValido(cpf)) return json(400, { erro: 'CPF inválido.' });

  const token = env.get('INFOSIMPLES_TOKEN'), chave = env.get('DATAJUD_API_KEY') || DATAJUD_CHAVE_PUBLICA;
  if (!token) return json(500, { erro: 'O sistema ainda não foi configurado (falta o token da Infosimples no Netlify).' });

  const trts = (env.get('TRTS') || '2,15').split(',').map(s => s.trim()).filter(Boolean);
  const certidoes = await Promise.all(trts.map(t => infosimplesCEAT(t, cpf, token).catch(e => ({ trt: t, ok: false, mensagem: e?.name === 'TimeoutError' ? 'O tribunal demorou demais. Tente de novo.' : 'Falha ao consultar o tribunal.' }))));
  const numeros = [...new Set(certidoes.flatMap(c => c.numeros || []))];
  const processos = await Promise.all(numeros.map(n => datajud(n, chave).catch(() => ({ numero: n, encontrado: false }))));

  return json(200, {
    cpf: cpf.replace(/^(\d{3})\.?\d{3}\.?\d{3}-?(\d{2})$/, '$1.***.***-$2'),
    nome: certidoes.find(c => c.nome)?.nome || null,
    consultado_em: new Date().toISOString(),
    certidoes, processos,
  });
};

export const config = { path: '/api/consultar' };
