export function bowDraw(time) {
  if (time < 0) return 0;
  if (time < 0.48) return Math.min(1, time / 0.48);
  return Math.max(0, 1 - (time - 0.48) / 0.075);
}
