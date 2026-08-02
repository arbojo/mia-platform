import { MemoryIndexer } from '../memory/memory-indexer';

function main() {
  console.log('\n=== Engineering Memory Index ===\n');

  const indexer = new MemoryIndexer();
  const index = indexer.indexAll();

  console.log(`Version: ${index.version}`);
  console.log(`Last scan: ${index.lastScan}`);
  console.log(`\nEntry counts:`);
  console.log(`  Decisions: ${index.totalEntries.decisions}`);
  console.log(`  Incidents: ${index.totalEntries.incidents}`);
  console.log(`  Patterns:  ${index.totalEntries.patterns}`);
  console.log(`  Lessons:   ${index.totalEntries.lessons}`);
  console.log(`  Total:     ${index.entries.length}`);

  console.log('\nRecent entries:');
  const recent = [...index.entries].reverse().slice(0, 5);
  for (const entry of recent) {
    console.log(`  [${entry.type}] ${entry.title} (${entry.source})`);
  }

  console.log('\nMemory index complete.');
}

main();
