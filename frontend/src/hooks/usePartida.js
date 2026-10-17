import { useCallback, useState } from "react";
import { Chess } from "chess.js";


// Fotografa o que a tela precisa saber do andamento jogo
// Facilita não ter um monte de jogo.fen() espalhado por ai
function resumirEstado(jogo) {
  return {
    posicao: jogo.fen(),
    turno: jogo.turn(),
    acabou: jogo.isGameOver(),
  };
}

/*
  Estado da partida. As regras ficam todas no chess.js; aqui a gente guarda
  a instância e publica um resumo pro React desenhar.

  A API da IA vai nesse arquivo, só chamar o jogar com a jogada dela
*/
export function usePartida() {

  const [jogo] = useState(() => new Chess());

  // O que a tela lê é este resumo, nunca a instância direto
  const [estado, setEstado] = useState(() => resumirEstado(jogo));

  const sincronizar = useCallback(() => {
    setEstado(resumirEstado(jogo));
  }, [jogo]);

  /*
    Tenta executar um lance ({ from, to })
    Devolve true quando o lance é legal o react-chessboard usa esse retorno pra decidir se a peça fica no destino ou volta pra casa
  */
  const jogar = useCallback(
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


  // Desfaz o último lance
  const voltarJogada = useCallback(
    (lances = 1) => {
      for (let i = 0; i < lances; i++) {
        if (!jogo.undo()) break;
      }
      sincronizar();
    },
    [jogo, sincronizar],
  );

  const reiniciar = useCallback(() => {
    jogo.reset();
    sincronizar();
  }, [jogo, sincronizar]);

  return {
    ...estado,
    jogar,
    voltarJogada,
    reiniciar,
  };

  const desistir = (() =>{
    // Ainda falta codar
  })

}
