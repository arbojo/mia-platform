import { execSync } from 'node:child_process';

async function main() {
  console.log('\n=== Post-Development Audit ===\n');

  // Step 1: Check git status
  console.log('[1/4] Checking repository state...');
  try {
    const status = execSync('git status --short', { encoding: 'utf8' }).trim();
    if (status) {
      console.log('  Uncommitted changes detected:');
      console.log(status.split('\n').map((l) => `  ${l}`).join('\n'));
    } else {
      console.log('  Working tree clean.');
    }
  } catch {
    console.log('  Could not check git status.');
  }

  // Step 2: Run validation
  console.log('[2/4] Running validation gates...');
  const gates = [
    { name: 'Lint', cmd: 'npm run lint' },
    { name: 'Build', cmd: 'npm run build' },
    { name: 'Unit Tests', cmd: 'npm run test:unit' },
  ];

  const results: Array<{ name: string; passed: boolean }> = [];
  for (const gate of gates) {
    process.stdout.write(`  ${gate.name}... `);
    try {
      execSync(gate.cmd, { encoding: 'utf8', timeout: 120000, stdio: 'pipe' });
      console.log('✓');
      results.push({ name: gate.name, passed: true });
    } catch {
      console.log('✗');
      results.push({ name: gate.name, passed: false });
    }
  }

  const allPassed = results.every((r) => r.passed);
  if (allPassed) {
    console.log('\n  All validation gates passed.');
  } else {
    const failed = results.filter((r) => !r.passed).map((r) => r.name);
    console.log(`\n  Failed gates: ${failed.join(', ')}`);
  }

  // Step 3: Run Council audit
  console.log('[3/4] Running Council audit...');
  try {
    execSync('npx tsx workshop/scripts/run-council-audit.ts', {
      encoding: 'utf8',
      timeout: 120000,
      stdio: 'inherit',
    });
  } catch {
    console.log('  Council audit encountered errors (advisory only).');
  }

  // Step 4: Update memory
  console.log('[4/4] Updating engineering memory...');
  try {
    execSync('npx tsx workshop/scripts/memory-index.ts', {
      encoding: 'utf8',
      timeout: 60000,
      stdio: 'pipe',
    });
    console.log('  Memory updated.');
  } catch {
    console.log('  Memory index unavailable (will be available after Phase 2).');
  }

  console.log('\n=== Post-Development Audit Complete ===\n');
}

main().catch((err) => {
  console.error('Post-development audit failed:', err);
  process.exit(1);
});
