import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const badgesDir = path.join(root, 'badges')
const coverageFile = path.join(root, 'coverage', 'coverage-summary.json')
const e2eFile = path.join(root, 'test-results', 'e2e.json')

const COLORS = [
  { min: 90, color: '#4c1' },
  { min: 80, color: '#97ca00' },
  { min: 70, color: '#a4a61d' },
  { min: 60, color: '#dfb317' },
  { min: 50, color: '#fe7d37' },
  { min: 0, color: '#e05d44' },
]

function colorFor(value) {
  const match = COLORS.find((c) => value >= c.min)
  return match ? match.color : '#e05d44'
}

function badgeSvg(label, value, color) {
  const labelW = label.length * 7 + 12
  const valueW = value.length * 7 + 12
  const totalW = labelW + valueW
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <rect width="${labelW}" height="20" fill="#555"/>
  <rect x="${labelW}" width="${valueW}" height="20" fill="${color}"/>
  <text x="${labelW / 2}" y="14" font-family="DejaVu Sans, Verdana, sans-serif" font-size="11" fill="#fff" text-anchor="middle">${label}</text>
  <text x="${labelW + valueW / 2}" y="14" font-family="DejaVu Sans, Verdana, sans-serif" font-size="11" fill="#fff" text-anchor="middle">${value}</text>
</svg>
`
}

function writeBadge(name, label, value, color) {
  mkdirSync(badgesDir, { recursive: true })
  writeFileSync(path.join(badgesDir, name), badgeSvg(label, value, color), 'utf-8')
  console.log(`✓ badges/${name} — ${label}: ${value}`)
}

let generated = 0

if (existsSync(coverageFile)) {
  const summary = JSON.parse(readFileSync(coverageFile, 'utf-8'))
  const total = summary.total

  const metrics = [
    ['coverage-lines.svg', 'lines', total.lines],
    ['coverage-branches.svg', 'branches', total.branches],
    ['coverage-functions.svg', 'functions', total.functions],
    ['coverage-statements.svg', 'statements', total.statements],
  ]

  for (const [file, label, metric] of metrics) {
    if (metric && typeof metric.pct === 'number') {
      const pct = metric.pct.toFixed(1) + '%'
      writeBadge(file, label, pct, colorFor(metric.pct))
      generated++
    }
  }
} else {
  console.warn(`⚠ coverage summary not found at ${coverageFile}. Skipping coverage badges.`)
}

if (existsSync(e2eFile)) {
  const json = JSON.parse(readFileSync(e2eFile, 'utf-8'))
  const stats = json.stats
  if (stats) {
    const expected = stats.expected ?? 0
    const skipped = stats.skipped ?? 0
    const unexpected = stats.unexpected ?? 0
    const total = expected + skipped + unexpected
    const label = 'e2e'
    const value = `${expected}/${total}`
    const color = unexpected > 0 ? '#e05d44' : '#4c1'
    writeBadge('e2e.svg', label, value, color)
    generated++
  }
} else {
  console.warn(`⚠ e2e results not found at ${e2eFile}. Skipping e2e badge.`)
}

console.log(`\nDone. ${generated} badge(s) generated in badges/.`)
process.exit(generated > 0 ? 0 : 1)
