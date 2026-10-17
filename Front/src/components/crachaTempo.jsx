import { formatarTempo } from "../utils/tempo";

/* Crachá escuro com o tempo do jogador (ex.: 10:05). */
export function CrachaTempo({ segundos }) {
  return (
    <span className="rounded-md bg-black/60 px-3 py-1 text-sm font-bold text-white tabular-nums">
      {formatarTempo(segundos)}
    </span>
  );
}
