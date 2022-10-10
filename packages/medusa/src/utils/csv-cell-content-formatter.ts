export function csvCellContentFormatter(str: string): string {
  const newLineRegexp = new RegExp(/\n/g)
  const doubleQuoteRegexp = new RegExp(/"/g)

  const hasNewLineChar = !!str.match(newLineRegexp)
  if (!hasNewLineChar) {
    return str
  }

  const formatterStr = str.replace(doubleQuoteRegexp, `""`)

  return `"${formatterStr}"`
}

export function csvRevertCellContentFormatter(str: string): string {
  if (str.startsWith(`"`)) {
    str = str.substring(1, str.length - 1)
  }
  return str
}
