// Cliente HTTP da API do backend (FastAPI + Stockfish).
// A URL base vem de VITE_API_URL; sem ela, cai no servidor local de dev.

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

/*
  Erro que carrega o que o backend respondeu ({ error, detail }) e o status.
  status 0 = nem chegou no servidor (offline, CORS, etc).
*/
export class ErroApi extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.name = "ErroApi";
    this.status = status;
  }
}

async function requisitar(caminho, opcoes = {}) {
  let resposta;
  try {
    resposta = await fetch(`${API_URL}${caminho}`, opcoes);
  } catch (erro) {
    // AbortError é cancelamento nosso, então deixa subir pro chamador ignorar
    if (erro?.name === "AbortError") throw erro;
    throw new ErroApi("Não foi possível falar com o servidor.", 0);
  }

  if (!resposta.ok) {
    const dados = await resposta.json().catch(() => null);
    throw new ErroApi(dados?.detail ?? `Erro ${resposta.status} na API.`, resposta.status);
  }

  return resposta.json();
}

function post(caminho, corpo, signal) {
  return requisitar(caminho, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    signal,
  });
}

function get(caminho, signal) {
  return requisitar(caminho, { signal });
}

/*
  Lance do adversário IA para a posição atual.
  Request: { fen, level } (level: "beginner" | "intermediate" | "advanced")
  Response: { move, san, score_cp, mate_in, level } — move vem em UCI
  (ex.: "e7e5" ou "e7e8q" quando tem promoção).
*/
export function pedirLanceAdversario({ fen, level, signal }) {
  return post("/v1/best-move", { fen, level }, signal);
}


export function pedirAnalise({ fen, move, explanationMode = "rule", signal }) {
  return post(
    "/v1/analysis",
    { fen, move, options: { explanation_mode: explanationMode } },
    signal,
  );
}

/*
  Avaliação da posição atual, sempre do ponto de vista das brancas.
  É a fonte da barra de vantagem: ela reflete o tabuleiro de agora,
  não o lance que acabou de ser analisado.
  Response: { fen, turn, score_cp, mate_in, win_rate, depth }
*/
export function pedirAvaliacaoPosicao({ fen, depth, signal }) {
  // Sem depth, o backend usa POSITION_EVAL_DEPTH (default 12)
  return post("/v1/evaluate", { fen, depth }, signal);
}

/*
  O que o backend consegue oferecer neste ambiente.
  llm_available = false quando as credenciais da Azure não estão configuradas.
*/
export function pedirConfig({ signal } = {}) {
  return get("/v1/config", signal);
}
