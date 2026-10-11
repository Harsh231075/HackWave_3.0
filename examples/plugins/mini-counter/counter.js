let count = 0
const output = document.getElementById('count')
document.getElementById('increment').onclick = () => { output.textContent = String(++count) }
document.getElementById('reset').onclick = () => { count = 0; output.textContent = '0' }
