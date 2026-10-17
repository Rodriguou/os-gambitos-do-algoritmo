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

async function post(caminho, corpo, signal) {
  let resposta;
  try {
    resposta = await fetch(`${API_URL}${caminho}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal,
    });
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

/*
  Lance do adversário IA para a posição atual.
  Request: { fen, level } (level: "beginner" | "intermediate" | "advanced")
  Response: { move, san, score_cp, mate_in, level } — move vem em UCI
  (ex.: "e7e5" ou "e7e8q" quando tem promoção).
*/
export function pedirLanceAdversario({ fen, level, signal }) {
  return post("/v1/best-move", { fen, level }, signal);
}
