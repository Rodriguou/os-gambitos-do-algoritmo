import { useEffect, useState } from "react";
import { pedirAvaliacaoPosicao } from "../services/api";

/*
  Avaliação da posição atual para a barra de vantagem.

  A cada FEN nova a requisição anterior é abortada: o tabuleiro pode mudar
  (lance, volta de jogada, nova partida) antes da resposta chegar, e uma
  avaliação velha pintaria a barra errada.
*/
export function useAvaliacaoPosicao(fen, { depth } = {}) {
  const [avaliacao, setAvaliacao] = useState(null);

  useEffect(() => {
    if (!fen) return;

    const controlador = new AbortController();

    pedirAvaliacaoPosicao({ fen, depth, signal: controlador.signal })
      .then((resposta) => {
        if (!controlador.signal.aborted) setAvaliacao(resposta);
      })
      .catch((erro) => {
        // Barra sem avaliação cai no 0.5 (equilibrado), sem quebrar a partida
        if (erro?.name !== "AbortError" && !controlador.signal.aborted) {
          setAvaliacao(null);
        }
      });

    return () => controlador.abort();
  }, [fen, depth]);

  // Só devolve a avaliação se ela for da posição que está no tabuleiro agora
  return { avaliacao: avaliacao?.fen === fen ? avaliacao : null };
}
