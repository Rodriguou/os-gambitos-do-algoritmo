// Dificuldade da IA alimenta o seletor "Nível" do cabeçalho
// "api" é o level que o backend espera em /v1/best-move
export const NIVEIS_DIFICULDADE = [
  { id: "facil", nome: "Fácil", api: "beginner" },
  { id: "intermediario", nome: "Intermediário", api: "intermediate" },
  { id: "dificil", nome: "Difícil", api: "advanced" },
];

// Começa no Fácil: quem está aprendendo não precisa levar mate em 8 lances
export const NIVEL_PADRAO = NIVEIS_DIFICULDADE[0];
