import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { pedirLanceAdversario } from "../services/api";
import { descreverFim } from "../utils/fimPartida";


// Fotografa o que a tela precisa saber do andamento jogo
// Facilita não ter um monte de jogo.fen() espalhado por ai
function resumirEstado(jogo) {
  const fim = descreverFim(jogo);
  return {
    posicao: jogo.fen(),
    turno: jogo.turn(),
    fim,
    acabou: fim !== null,
  };
}

/*
  Estado da partida. As regras ficam todas no chess.js; aqui a gente guarda
  a instância e publica um resumo pro React desenhar.

  O adversário é a IA (pretas): sempre que um lance deixa a vez com as pretas,
  a gente pede o lance pro backend (/v1/best-move) e aplica no tabuleiro.
  O jogador é o branco, que joga pelo próprio tabuleiro.
*/
export function usePartida({ nivel, onLanceJogador } = {}) {

  const [jogo] = useState(() => new Chess());

  // O que a tela lê é este resumo, nunca a instância direto
  const [estado, setEstado] = useState(() => resumirEstado(jogo));

  // Verdadeiro enquanto a IA está calculando (trava o tabuleiro)
  const [pensando, setPensando] = useState(false);

  // O jogador desistiu: fim de partida que não vem do tabuleiro
  const [desistiu, setDesistiu] = useState(false);

  // Request da IA em andamento, pra poder cancelar quando a posição muda
  const controladorRef = useRef(null);

  const sincronizar = useCallback(() => {
    setEstado(resumirEstado(jogo));
  }, [jogo]);

  /*
    Executa um lance ({ from, to, promotion }) na instância.
    Devolve true quando o lance é legal; o react-chessboard usa isso
    pra decidir se a peça fica no destino ou volta pra casa.
  */
  const aplicarLance = useCallback(
    ({ from, to, promotion = "q" }) => {
      try {
        jogo.move({ from, to, promotion });
        sincronizar();
        return true;
      } catch {
        // Lance ilegal, a peça volta pra casa dela sem drama
        return false;
      }
    },
    [jogo, sincronizar],
  );

  /*
    Aplica um lance que veio da API em UCI (ex.: "e7e5" ou "e7e8q").
    O chess.js quer { from, to, promotion }, então a gente quebra a string.
  */
  const aplicarUci = useCallback(
    (uci) =>
      aplicarLance({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : "q",
      }),
    [aplicarLance],
  );

  // Cancela qualquer request da IA em andamento (posição vai mudar)
  const cancelarIA = useCallback(() => {
    controladorRef.current?.abort();
    controladorRef.current = null;
    setPensando(false);
  }, []);

  /*
    Pede o lance da IA pro backend e aplica no tabuleiro.
    A posição atual vem da própria instância do chess.js.
  */
  const buscarLanceIA = useCallback(async () => {
    // Qualquer request anterior perdeu a validade
    controladorRef.current?.abort();

    const controller = new AbortController();
    controladorRef.current = controller;
    setPensando(true);

    try {
      const resposta = await pedirLanceAdversario({
        fen: jogo.fen(),
        level: nivel?.api ?? "intermediate",
        signal: controller.signal,
      });
      // Só aplica se este ainda é o request atual (não voltou/reiniciou/desistiu)
      if (controladorRef.current !== controller) return;
      aplicarUci(resposta.move);
    } catch (erro) {
      if (erro?.name === "AbortError") return;
      console.error("Falha ao pedir o lance da IA:", erro);
    } finally {
      if (controladorRef.current === controller) {
        controladorRef.current = null;
        setPensando(false);
      }
    }
  }, [jogo, nivel, aplicarUci]);


  const jogar = useCallback(
    ({ from, to, promotion = "q" }) => {
      if (desistiu) return false;

      // Guarda a posição ANTES do lance: é isso que a API de análise espera
      const fenAntes = jogo.fen();

      // Só manda promoção no UCI quando o peão realmente corona
      const peca = jogo.get(from);
      const corona = peca?.type === "p" && (to[1] === "8" || to[1] === "1");
      const uci = corona ? `${from}${to}${promotion}` : `${from}${to}`;

      const ok = aplicarLance({ from, to, promotion });
      if (!ok) return false;

      // Avisa a página pra analisar o lance e atualizar a barra de vantagem
      onLanceJogador?.({ fen: fenAntes, move: uci });

      if (jogo.turn() === "b" && !jogo.isGameOver()) {
        buscarLanceIA();
      }
      return true;
    },
    [desistiu, aplicarLance, jogo, buscarLanceIA, onLanceJogador],
  );


  // Desfaz a rodada inteira do jogador: o lance dele e a resposta da IA
  const voltarJogada = useCallback(() => {
    if (desistiu) return;

    cancelarIA();

    const lances = jogo.turn() === "w" ? 2 : 1;
    for (let i = 0; i < lances; i++) {
      if (!jogo.undo()) break;
    }

    sincronizar();
  }, [desistiu, cancelarIA, jogo, sincronizar]);


  const reiniciar = useCallback(() => {
    cancelarIA();
    jogo.reset();
    setDesistiu(false);
    sincronizar();
  }, [cancelarIA, jogo, sincronizar]);

  
  // O jogador entrega os pontos; a IA vence sem lance
  const desistir = useCallback(() => {
    cancelarIA();
    setDesistiu(true);
  }, [cancelarIA]);

  // Se a tela sair no meio de um pensamento, mata o request pendente
  useEffect(() => () => controladorRef.current?.abort(), []);

  // A desistência é um fim de jogo que não está no tabuleiro
  const fim = desistiu ? { motivo: "desistencia", vencedor: "pretas" } : estado.fim;

  return {
    ...estado,
    fim,
    acabou: estado.acabou || desistiu,
    pensando,
    podeVoltar: !desistiu && jogo.history().length > 0,
    jogar,
    voltarJogada,
    reiniciar,
    desistir,
  };
}
