/** Format a time stored in hundredths of a second as `MM:SS.cc`. */
export function formatTime(timeCs: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const cs = timeCs % 100;
  const totalSec = Math.floor(timeCs / 100);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${pad(minutes)}:${pad(seconds)}.${pad(cs)}`;
}
