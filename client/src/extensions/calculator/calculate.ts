/** Small arithmetic parser: expressions never run as JavaScript. */
export function calculate(expression: string): number {
  if (!expression.trim() || expression.length > 200) throw new Error('Enter an expression up to 200 characters.')
  const input = expression.replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-').replace(/\s/g, '')
  const tokens = input.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/%]/g) ?? []
  if (tokens.join('') !== input) throw new Error('Use numbers and arithmetic operators only.')
  let position = 0
  const take = () => tokens[position++]
  function primary(): number {
    let value: number
    if (tokens[position] === '+' || tokens[position] === '-') { const sign = take(); value = primary() * (sign === '-' ? -1 : 1) }
    else if (tokens[position] === '(') { take(); value = sum(); if (take() !== ')') throw new Error('Close every parenthesis.') }
    else { const token = take(); if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) throw new Error('Enter a number after each operator.'); value = Number(token) }
    while (tokens[position] === '%') { take(); value /= 100 }
    return value
  }
  function product(): number { let value = primary(); while (tokens[position] === '*' || tokens[position] === '/') { const operator = take(), next = primary(); if (operator === '/' && next === 0) throw new Error('Cannot divide by zero.'); value = operator === '*' ? value * next : value / next } return value }
  function sum(): number { let value = product(); while (tokens[position] === '+' || tokens[position] === '-') { const operator = take(), next = product(); value = operator === '+' ? value + next : value - next } return value }
  const result = sum()
  if (position !== tokens.length || !Number.isFinite(result)) throw new Error('Enter a valid, finite calculation.')
  return Number(result.toPrecision(12))
}
