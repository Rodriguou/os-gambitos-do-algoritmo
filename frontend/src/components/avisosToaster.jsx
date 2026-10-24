import { Toaster } from "react-hot-toast";

// Onde os avisos aparecem. Montado uma única vez, na página da partida.
// Usa as cores do tema (painel-fraco / fraco) pra combinar com os cards.
export function AvisosToaster() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3500,
        style: {
          background: "var(--color-painel-fraco)",
          color: "var(--color-fraco)",
          borderRadius: "1rem",
          fontWeight: 600,
          fontSize: "0.875rem",
          maxWidth: 420,
        },
      }}
    />
  );
}
