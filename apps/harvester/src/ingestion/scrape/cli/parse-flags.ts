export function parseFlags(argv: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {}

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      continue
    }

    const key = token.slice(2)
    const valueTokens: string[] = []
    let j = i + 1
    while (j < argv.length && !argv[j].startsWith('--')) {
      valueTokens.push(argv[j])
      j++
    }

    if (valueTokens.length > 0) {
      flags[key] = valueTokens.join(' ')
      i = j - 1
    } else {
      flags[key] = true
    }
  }

  return flags
}
