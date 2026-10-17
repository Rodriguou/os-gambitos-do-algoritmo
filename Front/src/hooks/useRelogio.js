import { useCallback, useEffect, useState } from "react";

/*
  Relógio de jogo de verdade: só o lado de quem é a vez marca tempo
  Recebe o turno do chess.js ("w" ou "b") e devolve os dois relógios
*/
export function useRelogio({ turno, tempoInicial = 0, rodando = true }) {

  const [tempos, setTempos] = useState(() => ({
    w: tempoInicial,
    b: tempoInicial,
  }));

  useEffect(() => {

    if (!rodando || !turno) return;

    const intervalo = setInterval(() => {
      setTempos((atual) => ({ ...atual, [turno]: atual[turno] + 1 }));
    }, 1000);

    return () => clearInterval(intervalo);
  }, [rodando, turno]);

  // Zera os dois cronômetros de volta pra base
  const reiniciarRelogio = useCallback(() => {
    setTempos({ w: tempoInicial, b: tempoInicial });
  }, [tempoInicial]);

  return {
    tempoBrancas: tempos.w,
    tempoPretas: tempos.b,
    reiniciarRelogio,
  };
}
