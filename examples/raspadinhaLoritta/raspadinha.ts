import { existsSync } from "node:fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";

/** Os 5 emojis possíveis do cartão. */
export const EMOJIS = ["🍪", "🍒", "⭐", "💎", "🎁"] as const;
export type Emoji = (typeof EMOJIS)[number];
export type Grade = Emoji[][];

const TAMANHO_GRADE = 3;
const CELULA = 132;
const ESPACO = 12;
const CARTAO = 560;
const FONTE = '"Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", sans-serif';
const FUNDO = "./assets/fundo_raspadinha.png";

const LARGURA_GRADE = TAMANHO_GRADE * CELULA + (TAMANHO_GRADE - 1) * ESPACO;
// Coordenadas fixas da grade: centralizada no cartão.
const GRADE_X = (CARTAO - LARGURA_GRADE) / 2;
const GRADE_Y = (CARTAO - LARGURA_GRADE) / 2;

export function gerarGrade(): Grade {
  const sortear = (): Emoji => EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  return Array.from({ length: TAMANHO_GRADE }, () => Array.from({ length: TAMANHO_GRADE }, sortear));
}

function tresIguais(linha: Emoji[]): boolean {
  return linha.every((emoji, i) => i === 0 || emoji === linha[i - 1]);
}

/** Vitória: 3 emojis iguais na horizontal, vertical ou diagonal. */
export function temTresIguais(grade: Grade): boolean {
  const colunas = grade.map((_, col) => grade.map(linha => linha[col]));
  const diagonais = [
    grade.map((linha, i) => linha[i]),
    grade.map((linha, i) => linha[TAMANHO_GRADE - 1 - i]),
  ];
  return [...grade, ...colunas, ...diagonais].some(tresIguais);
}

/** Renderiza o PNG: fundo opcional + grade 3x3 de emojis. */
export async function renderizarCartao(grade: Grade): Promise<Buffer> {
  const canvas = createCanvas(CARTAO, CARTAO);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, CARTAO, CARTAO);

  // Fundo opcional: se o PNG não existir, o fundo sólido acima continua valendo.
  if (existsSync(FUNDO)) {
    ctx.drawImage(await loadImage(FUNDO), 0, 0, CARTAO, CARTAO);
  }

  // Fonte com fallback de emojis coloridos (Windows e Linux).
  ctx.font = `${Math.round(CELULA * 0.6)}px ${FONTE}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  grade.forEach((linha, row) => {
    linha.forEach((emoji, col) => {
      // Tabela: x/y fixos por coluna/linha, com o espaçamento entre células.
      const x = GRADE_X + col * (CELULA + ESPACO);
      const y = GRADE_Y + row * (CELULA + ESPACO);
      ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
      ctx.beginPath();
      ctx.roundRect(x, y, CELULA, CELULA, 16);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(emoji, x + CELULA / 2, y + CELULA / 2);
    });
  });

  return canvas.toBuffer("image/png");
}
