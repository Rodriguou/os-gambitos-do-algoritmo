import toast from "react-hot-toast";

// Dispara o aviso de lance ilegal. Aceita null (nada a explicar).
// O id é o tipo do aviso: se o jogador insistir no mesmo erro, o toast
// é reaproveitado em vez de empilhar cópias.
export function avisarLanceIlegal(aviso) {
  if (!aviso) return;
  toast(aviso.mensagem, { id: aviso.tipo, icon: "⚠️" });
}
