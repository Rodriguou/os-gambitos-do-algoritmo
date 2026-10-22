import { FUNDOS } from "../constants/fundos";

// Chave com prefixo do app pra não brigar com outro projeto no mesmo domínio
const CHAVE = "gambitos:fundo";

/*
  Lê o fundo salvo no navegador
  Se o id não existir mais (ou o storage estiver bloqueado), volta pro padrão
*/
export function carregarFundo() {
  try {
    const id = localStorage.getItem(CHAVE);
    return FUNDOS.find((fundo) => fundo.id === id) ?? FUNDOS[0];
  } catch {
    // Modo privado ou storage bloqueado: segue a vida com a madeira
    return FUNDOS[0];
  }
}

export function salvarFundo(fundo) {
  try {
    localStorage.setItem(CHAVE, fundo.id);
  } catch {
    // Sem storage a troca continua valendo só nesta sessão
  }
}
