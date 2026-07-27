#!/usr/bin/env node

/**
 * MIA Memory Scan Script
 * 
 * Analyzes git history, technical debt, and project patterns.
 * Read-only: never modifies source code or AGENTS.md.
 * 
 * Usage: node scripts/memory-scan.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '..', '.mia-memory');
const INDEX_FILE = path.join(MEMORY_DIR, 'index.json');
const TECH_DEBT_DIR = path.join(__dirname, '..', 'docs', 'technical-debt');

function run(command) {
  try {
    return execSync(command, { encoding: 'utf-8', cwd: path.join(__dirname, '..') }).trim();
  } catch {
    return null;
  }
}

function analyzeGitHistory() {
  const log = run('git log --oneline -50');
  if (!log) return { commits: 0, patterns: [] };
  
  const commits = log.split('\n').filter(Boolean);
  const patterns = [];
  
  const commitTypes = {};
  commits.forEach(line => {
    const match = line.match(/^[a-f0-9]+ (\w+):/);
    if (match) {
      const type = match[1];
      commitTypes[type] = (commitTypes[type] || 0) + 1;
    }
  });
  
  const frequentTypes = Object.entries(commitTypes)
    .filter(([, count]) => count >= 3)
    .map(([type, count]) => ({ type, count }));
  
  if (frequentTypes.length > 0) {
    patterns.push({
      type: 'commit_frequency',
      description: `Frequent commit types: ${frequentTypes.map(t => `${t.type}(${t.count})`).join(', ')}`,
      severity: 'info'
    });
  }
  
  const fixCommits = commits.filter(c => c.includes('fix:'));
  if (fixCommits.length >= 3) {
    patterns.push({
      type: 'repeated_fixes',
      description: `${fixCommits.length} fix commits detected in recent history`,
      severity: 'warning'
    });
  }
  
  return { commits: commits.length, patterns };
}

function analyzeTechnicalDebt() {
  if (!fs.existsSync(TECH_DEBT_DIR)) return { files: 0, issues: [] };
  
  const files = fs.readdirSync(TECH_DEBT_DIR).filter(f => f.endsWith('.md'));
  const issues = [];
  
  files.forEach(file => {
    const content = fs.readFileSync(path.join(TECH_DEBT_DIR, file), 'utf-8');
    
    const highPriority = (content.match(/priority:\s*high/gi) || []).length;
    const mediumPriority = (content.match(/priority:\s*medium/gi) || []).length;
    const lowPriority = (content.match(/priority:\s*low/gi) || []).length;
    
    if (highPriority > 0) {
      issues.push({
        file,
        highPriority,
        mediumPriority,
        lowPriority
      });
    }
  });
  
  return { files: files.length, issues };
}

function analyzeMemoryEntries() {
  if (!fs.existsSync(INDEX_FILE)) return { total: 0, entries: [] };
  
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  return {
    total: index.totalEntries.decisions + index.totalEntries.incidents + 
           index.totalEntries.patterns + index.totalEntries.lessons,
    entries: index.entries || []
  };
}

function analyzeFileChanges() {
  const changes = run('git log --oneline --name-only -20');
  if (!changes) return { hotFiles: [] };
  
  const fileCounts = {};
  changes.split('\n').forEach(line => {
    if (!line.includes('/') && !line.includes('.')) return;
    if (line.match(/^[a-f0-9]+ /)) return;
    
    const file = line.trim();
    if (file && !file.startsWith('node_modules') && !file.startsWith('.next')) {
      fileCounts[file] = (fileCounts[file] || 0) + 1;
    }
  });
  
  const hotFiles = Object.entries(fileCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([file, count]) => ({ file, count }));
  
  return { hotFiles };
}

function generateReport() {
  console.log('\nMIA Memory Scan Report');
  console.log('══════════════════════');
  console.log(`Date: ${new Date().toISOString()}\n`);
  
  const git = analyzeGitHistory();
  console.log(`Commits analyzed: ${git.commits}`);
  if (git.patterns.length > 0) {
    console.log('Git patterns:');
    git.patterns.forEach(p => {
      console.log(`  ${p.severity === 'warning' ? '⚠️' : 'ℹ️'} ${p.description}`);
    });
  }
  
  const debt = analyzeTechnicalDebt();
  console.log(`\nTechnical debt files: ${debt.files}`);
  if (debt.issues.length > 0) {
    console.log('High priority issues:');
    debt.issues.forEach(issue => {
      console.log(`  ⚠️ ${issue.file}: ${issue.highPriority} high, ${issue.mediumPriority} medium, ${issue.lowPriority} low`);
    });
  }
  
  const memory = analyzeMemoryEntries();
  console.log(`\nMemory entries: ${memory.total}`);
  
  const files = analyzeFileChanges();
  if (files.hotFiles.length > 0) {
    console.log('\nFrequently modified files:');
    files.hotFiles.forEach(f => {
      console.log(`  📄 ${f.file} (${f.count} changes)`);
    });
  }
  
  console.log('\nStatus: Scan complete (read-only, no modifications)');
}

generateReport();
