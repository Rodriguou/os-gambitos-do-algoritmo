import { useCallback, useEffect, useState } from "react";

/*
  Um único relógio de partida, crescente.

  Ele começa em 00:00, anda enquanto a partida está viva e para sozinho
  no fim (xeque-mate, empate ou desistência). Voltar uma jogada não zera
  o tempo; só uma partida nova faz isso.
*/
export function useRelogioPartida({ rodando = true } = {}) {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    if (!rodando) return;

    const intervalo = setInterval(() => {
      setSegundos((atual) => atual + 1);
    }, 1000);

    return () => clearInterval(intervalo);
  }, [rodando]);

  const reiniciarRelogio = useCallback(() => setSegundos(0), []);

  return { tempoPartida: segundos, reiniciarRelogio };
}
