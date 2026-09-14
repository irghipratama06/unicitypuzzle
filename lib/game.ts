export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type Board = number[];

export const LEVELS: Record<Difficulty, { label: string; fee: number; target: number; moves: number }> = {
  easy: { label: 'Easy', fee: 5, target: 512, moves: 180 },
  medium: { label: 'Medium', fee: 10, target: 1024, moves: 150 },
  hard: { label: 'Hard', fee: 25, target: 2048, moves: 120 },
  expert: { label: 'Expert', fee: 50, target: 4096, moves: 100 },
};

export const emptyBoard = (): Board => Array(16).fill(0);

export function spawnTile(board: Board): Board {
  const empty = board.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
  if (!empty.length) return board;
  const index = empty[Math.floor(Math.random() * empty.length)];
  const next = [...board];
  next[index] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

export function newGame(): Board {
  return spawnTile(spawnTile(emptyBoard()));
}

function slide(line: number[]): { line: number[]; score: number } {
  const compact = line.filter(Boolean);
  const result: number[] = [];
  let score = 0;
  for (let i = 0; i < compact.length; i++) {
    if (compact[i] === compact[i + 1]) {
      const merged = compact[i] * 2;
      result.push(merged);
      score += merged;
      i++;
    } else {
      result.push(compact[i]);
    }
  }
  while (result.length < 4) result.push(0);
  return { line: result, score };
}

export function move(board: Board, direction: 'left' | 'right' | 'up' | 'down'): { board: Board; score: number; moved: boolean } {
  const next = Array(16).fill(0);
  let score = 0;
  const read = (r: number, c: number) => board[r * 4 + c];
  const write = (r: number, c: number, v: number) => { next[r * 4 + c] = v; };

  for (let i = 0; i < 4; i++) {
    const line = direction === 'left' || direction === 'right'
      ? Array.from({ length: 4 }, (_, j) => read(i, j))
      : Array.from({ length: 4 }, (_, j) => read(j, i));
    const oriented = direction === 'right' || direction === 'down' ? line.reverse() : line;
    const slid = slide(oriented);
    const restored = direction === 'right' || direction === 'down' ? slid.line.reverse() : slid.line;
    restored.forEach((v, j) => direction === 'left' || direction === 'right' ? write(i, j, v) : write(j, i, v));
    score += slid.score;
  }

  const moved = next.some((v, i) => v !== board[i]);
  return { board: moved ? spawnTile(next) : board, score, moved };
}

export function canMove(board: Board): boolean {
  if (board.some((v) => v === 0)) return true;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const v = board[r * 4 + c];
    if (c < 3 && v === board[r * 4 + c + 1]) return true;
    if (r < 3 && v === board[(r + 1) * 4 + c]) return true;
  }
  return false;
}

export function maxTile(board: Board): number {
  return Math.max(...board);
}
