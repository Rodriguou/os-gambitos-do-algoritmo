// Formata segundos em mm:ss
export function formatarTempo(segundos) {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;

  return `${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}
