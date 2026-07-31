import { execSync } from 'child_process'

function runAll() {
  console.log('= MIA Safety Layer — Production Test Suite')
  console.log('='.repeat(50))
  console.log()

  const modules = [
    '01-fast-path',
    '02-price-validation',
    '03-delivery-validation',
    '04-guarantee-validation',
    '05-discount-validation',
    '06-immutable-memory',
    '07-retry-behavior',
    '08-failure-fallback',
    '09-regression',
  ]

  let exitCode = 0

  for (const mod of modules) {
    console.log(`\n[${mod}]`)
    try {
      execSync(`npx tsx tests/safety/${mod}.test`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      })
    } catch (err) {
      exitCode = 1
    }
  }

  process.exit(exitCode)
}

runAll()
