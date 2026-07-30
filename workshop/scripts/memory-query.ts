import { MemoryIndexer, type MemoryEntryType, type MemoryEntrySource, type MemoryEntryStatus } from '../memory/memory-indexer';

function main() {
  const args = process.argv.slice(2);
  const filters: {
    type?: MemoryEntryType;
    source?: MemoryEntrySource;
    status?: MemoryEntryStatus;
    tag?: string;
    search?: string;
  } = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--type':
      case '-t':
        filters.type = args[++i] as MemoryEntryType;
        break;
      case '--source':
      case '-s':
        filters.source = args[++i] as MemoryEntrySource;
        break;
      case '--status':
      case '-st':
        filters.status = args[++i] as MemoryEntryStatus;
        break;
      case '--tag':
      case '-g':
        filters.tag = args[++i];
        break;
      case '--search':
      case '-q':
        filters.search = args[++i];
        break;
      case '--help':
      case '-h':
        showHelp();
        return;
    }
  }

  const indexer = new MemoryIndexer();
  const results = indexer.query(filters);

  console.log(`\n=== Memory Query Results ===\n`);

  if (results.length === 0) {
    console.log('No entries match the given filters.');
    console.log(`\nUsage: npm run memory-query -- [options]`);
    console.log(`  --type, -t <type>     Filter by type (decision|incident|pattern|lesson)`);
    console.log(`  --source, -s <src>    Filter by source (adr|council|observer|manual)`);
    console.log(`  --status, -st <st>    Filter by status (active|archived|superseded)`);
    console.log(`  --tag, -g <tag>       Filter by tag`);
    console.log(`  --search, -q <text>   Full-text search in title, body, and tags`);
    return;
  }

  console.log(`Found ${results.length} entries:\n`);

  for (const entry of results) {
    console.log(`[${entry.id}]`);
    console.log(`  Type:   ${entry.type}`);
    console.log(`  Title:  ${entry.title}`);
    console.log(`  Source: ${entry.source} (${entry.sourceRef})`);
    console.log(`  Status: ${entry.status}`);
    console.log(`  Tags:   ${entry.tags.join(', ')}`);
    console.log(`  Body:   ${entry.body.slice(0, 200)}${entry.body.length > 200 ? '...' : ''}`);
    console.log('');
  }
}

function showHelp(): void {
  console.log(`Usage: npm run memory-query -- [options]

Options:
  --type, -t <type>     Filter by entry type
                        Types: decision, incident, pattern, lesson

  --source, -s <src>    Filter by source
                        Sources: adr, council, observer, manual

  --status, -st <st>    Filter by status
                        Statuses: active, archived, superseded

  --tag, -g <tag>       Filter by tag (e.g., "council", "adr")

  --search, -q <text>   Full-text search in title, body, and tags

  --help, -h            Show this help

Examples:
  npm run memory-query -- --type decision
  npm run memory-query -- --tag council
  npm run memory-query -- --search "Evidence First"
  npm run memory-query -- --source adr --status active
`);
}

main();
