const p = (n: number) => String(n).padStart(2, '0')

export function formatTime(t: number) {
  const d = new Date(t)
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
