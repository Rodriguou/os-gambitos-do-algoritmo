// Modos que aparecem no menu sanduíche
export const MODOS_PARTIDA = [
  { id: "casual", nome: "Partida Casual" },
  { id: "classico", nome: "Clássico" },
  { id: "ranqueado", nome: "Ranqueado" },
];

// Dificuldade da IA alimenta o seletor "Nível" do cabeçalho
// "api" é o level que o backend espera em /v1/best-move
export const NIVEIS_DIFICULDADE = [
  { id: "facil", nome: "Fácil", api: "beginner" },
  { id: "intermediario", nome: "Intermediário", api: "intermediate" },
  { id: "dificil", nome: "Difícil", api: "advanced" },
];

// Relógio inicial em segundos (começa zerado)
export const TEMPO_INICIAL = 0;
