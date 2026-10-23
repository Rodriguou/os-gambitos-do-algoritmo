import { useEffect, useState } from "react";
import { pedirConfig } from "../services/api";

/*
  Capacidades do backend (por enquanto, se a Azure está configurada).
  Enquanto a resposta não chega, config é null e a interface trata a
  Azure como indisponível.
*/
export function useConfig() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const controlador = new AbortController();

    pedirConfig({ signal: controlador.signal })
      .then((resposta) => {
        if (!controlador.signal.aborted) setConfig(resposta);
      })
      .catch((erro) => {
        if (erro?.name !== "AbortError" && !controlador.signal.aborted) {
          setConfig({ llm_available: false, explainer_default_mode: "rule" });
        }
      });

    return () => controlador.abort();
  }, []);

  return config;
}
