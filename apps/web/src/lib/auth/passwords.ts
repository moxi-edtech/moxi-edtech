import crypto from "node:crypto";

const WORDS = [
  // Frutas e Legumes
  "abacaxi", "banana", "caju", "goiaba", "manga", "pera", "uva", "limao", "kiwi", "morango",
  "beringela", "couve", "abobora", "cenoura", "alface", "tomate", "milho", "ginguba",
  // Animais
  "leao", "tigre", "gato", "cao", "lobo", "urso", "zebra", "girafa", "pato", "aguia", "foca",
  "macaco", "elefante", "coelho", "peixe",
  // Coisas e Doces
  "sambapito", "pirolito", "cacau", "mel", "doce", "bala", "pipoca", "pao", "bola", "carro", "bengala",
  // Lugares e Cores
  "luanda", "benguela", "lobito", "huambo", "namibe", "praia", "campo", "cidade",
  "azul", "verde", "vermelho", "amarelo", "branco", "preto", "rosa"
];

/**
 * Generates a human-friendly password: Word@4Digits
 * Example: sambapito@4921, beringela@8812
 */
export function generateFriendlyPassword(): string {
  const word = WORDS[crypto.randomInt(0, WORDS.length)];
  const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
  const num = crypto.randomInt(1000, 9999);
  return `${capitalized}@${num}`;
}
