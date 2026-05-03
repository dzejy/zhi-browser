export function fuzzyMatch(query: string, target: string): { matched: boolean; score: number } {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (!q) return { matched: true, score: 0 }
  if (t.includes(q)) return { matched: true, score: 100 - t.indexOf(q) }
  const initials = t
    .split('')
    .filter((_, i) => i === 0 || t[i - 1] === ' ')
    .join('')
  if (initials.includes(q)) return { matched: true, score: 50 }
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  if (qi === q.length) return { matched: true, score: 30 }
  return { matched: false, score: 0 }
}
