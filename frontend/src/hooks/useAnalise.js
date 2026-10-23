import { useCallback, useEffect, useRef, useState } from "react";
import { pedirAnalise } from "../services/api";

/*
  Estado da análise do último lance do jogador, que alimenta os cards de dica.
  A barra de vantagem tem a própria avaliação da posição atual
  (useAvaliacaoPosicao.js); esta análise é sobre o lance já jogado.

  Cada lance novo cancela a análise anterior (AbortController), porque não faz
  sentido deixar uma resposta velha chegar depois e sobrescrever a posição atual
*/
export function useAnalise({ usarAzureInicial = false } = {}) {
  const [analise, setAnalise] = useState(null);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState(null);
  const [usarAzure, setUsarAzureState] = useState(usarAzureInicial);

  const controladorRef = useRef(null);

  // O modo vive num ref pra `analisar`
  const modoRef = useRef(usarAzureInicial ? "llm" : "rule");

  // Último pedido, pra reanalisar quando o usuário troca a tradução no meio
  const ultimoPedidoRef = useRef(null);

  const cancelar = useCallback(() => {
    controladorRef.current?.abort();
    controladorRef.current = null;
    setAnalisando(false);
  }, []);

  const analisar = useCallback(async ({ fen, move }) => {
    ultimoPedidoRef.current = { fen, move };

    controladorRef.current?.abort();

    const controller = new AbortController();
    controladorRef.current = controller;
    setAnalisando(true);
    setErro(null);
    // A análise anterior era de outro lance (ou de outra posição). Some com
    // ela na hora: cards velhos ao lado de um tabuleiro novo confundem mais
    // do que ajudam.
    setAnalise(null);

    try {
      const resposta = await pedirAnalise({
        fen,
        move,
        explanationMode: modoRef.current,
        signal: controller.signal,
      });
      // Só aplica se este ainda é o pedido atual (não reiniciou/voltou lance)
      if (controladorRef.current !== controller) return;
      setAnalise(resposta);
    } catch (falha) {
      if (falha?.name === "AbortError") return;
      // A análise antiga já foi limpa ao começar esta; resta avisar o erro
      setErro(falha);
    } finally {
      if (controladorRef.current === controller) {
        controladorRef.current = null;
        setAnalisando(false);
      }
    }
  }, []);


  // Liga/desliga a tradução da Azure.
  // Se já tem um lance analisado, refaz na hora pro texto acompanhar o switch
  const definirUsarAzure = useCallback(
    (ativo) => {
      const modo = ativo ? "llm" : "rule";
      if (modoRef.current === modo) {
        setUsarAzureState(ativo);
        return;
      }

      modoRef.current = modo;
      setUsarAzureState(ativo);

      if (ultimoPedidoRef.current) {
        analisar(ultimoPedidoRef.current);
      }
    },
    [analisar],
  );

  // Reinício de partida: some com a análise e com qualquer request pendente
  const limpar = useCallback(() => {
    cancelar();
    ultimoPedidoRef.current = null;
    setAnalise(null);
    setErro(null);
  }, [cancelar]);

  // Se a tela sair no meio da análise, mata o request pendente
  useEffect(() => () => controladorRef.current?.abort(), []);

  return {
    analise,
    analisando,
    erro,
    analisar,
    limpar,
    usarAzure,
    definirUsarAzure,
  };
}
