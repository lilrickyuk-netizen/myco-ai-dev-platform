import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export default async function globalTeardown() {
  console.log('🧹 Starting global test teardown...');

  // Clean up test containers
  if (process.env.START_TEST_DB === 'true') {
    try {
      console.log('🗄️  Stopping test database...');
      execSync('docker stop test-postgres', { stdio: 'ignore' });
      execSync('docker rm test-postgres', { stdio: 'ignore' });
      console.log('✅ Test database stopped and removed');
    } catch (error) {
      console.log('⚠️  Could not stop test database (may not have been running)');
    }
  }

  if (process.env.START_TEST_REDIS === 'true') {
    try {
      console.log('📦 Stopping test Redis...');
      execSync('docker stop test-redis', { stdio: 'ignore' });
      execSync('docker rm test-redis', { stdio: 'ignore' });
      console.log('✅ Test Redis stopped and removed');
    } catch (error) {
      console.log('⚠️  Could not stop test Redis (may not have been running)');
    }
  }

  // Generate combined coverage report
  await generateCombinedCoverage();

  // Clean up temporary test files if needed
  const tempDir = path.join(__dirname, 'temp');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('🗑️  Cleaned up temporary test files');
  }

  // Archive test results if in CI
  if (process.env.CI === 'true') {
    console.log('📦 Archiving test results for CI...');
    await archiveTestResults();
  }

  console.log('✅ Global test teardown completed');
}

async function generateCombinedCoverage() {
  console.log('📊 Generating combined coverage report...');

  try {
    const coverageDir = path.join(process.cwd(), 'coverage');
    const combinedDir = path.join(coverageDir, 'combined');

    if (!fs.existsSync(combinedDir)) {
      fs.mkdirSync(combinedDir, { recursive: true });
    }

    // Collect coverage data from all sources
    const coverageSources = [
      path.join(coverageDir, 'backend', 'coverage-final.json'),
      path.join(coverageDir, 'frontend', 'coverage-final.json'),
      path.join(coverageDir, 'integration', 'coverage-final.json')
    ];

    const combinedCoverage: any = {};

    for (const source of coverageSources) {
      if (fs.existsSync(source)) {
        const coverageData = JSON.parse(fs.readFileSync(source, 'utf8'));
        Object.assign(combinedCoverage, coverageData);
      }
    }

    // Write combined coverage file
    fs.writeFileSync(
      path.join(combinedDir, 'coverage-final.json'),
      JSON.stringify(combinedCoverage, null, 2)
    );

    // Generate combined HTML report using nyc
    try {
      execSync(`npx nyc report --reporter=html --report-dir=${combinedDir}/html`, {
        cwd: process.cwd(),
        stdio: 'ignore'
      });
      console.log('✅ Combined coverage HTML report generated');
    } catch (error) {
      console.log('⚠️  Could not generate combined HTML report');
    }

    // Generate coverage summary
    const summary = calculateCoverageSummary(combinedCoverage);
    fs.writeFileSync(
      path.join(combinedDir, 'summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('📊 Coverage Summary:');
    console.log(`   Lines: ${summary.lines.pct}% (${summary.lines.covered}/${summary.lines.total})`);
    console.log(`   Functions: ${summary.functions.pct}% (${summary.functions.covered}/${summary.functions.total})`);
    console.log(`   Branches: ${summary.branches.pct}% (${summary.branches.covered}/${summary.branches.total})`);
    console.log(`   Statements: ${summary.statements.pct}% (${summary.statements.covered}/${summary.statements.total})`);

    // Check if coverage meets thresholds
    const threshold = 85;
    const meetsThreshold = [
      summary.lines.pct >= threshold,
      summary.functions.pct >= threshold,
      summary.branches.pct >= threshold,
      summary.statements.pct >= threshold
    ].every(Boolean);

    if (meetsThreshold) {
      console.log('✅ All coverage thresholds met!');
    } else {
      console.log('❌ Some coverage thresholds not met');
      process.exitCode = 1;
    }

  } catch (error) {
    console.log('⚠️  Error generating combined coverage:', error);
  }
}

function calculateCoverageSummary(coverageData: any) {
  let totalLines = 0;
  let coveredLines = 0;
  let totalFunctions = 0;
  let coveredFunctions = 0;
  let totalBranches = 0;
  let coveredBranches = 0;
  let totalStatements = 0;
  let coveredStatements = 0;

  for (const file in coverageData) {
    const fileCoverage = coverageData[file];
    
    if (fileCoverage.l) {
      for (const line in fileCoverage.l) {
        totalLines++;
        if (fileCoverage.l[line] > 0) coveredLines++;
      }
    }

    if (fileCoverage.f) {
      for (const func in fileCoverage.f) {
        totalFunctions++;
        if (fileCoverage.f[func] > 0) coveredFunctions++;
      }
    }

    if (fileCoverage.b) {
      for (const branch in fileCoverage.b) {
        const branchData = fileCoverage.b[branch];
        for (let i = 0; i < branchData.length; i++) {
          totalBranches++;
          if (branchData[i] > 0) coveredBranches++;
        }
      }
    }

    if (fileCoverage.s) {
      for (const stmt in fileCoverage.s) {
        totalStatements++;
        if (fileCoverage.s[stmt] > 0) coveredStatements++;
      }
    }
  }

  return {
    lines: {
      total: totalLines,
      covered: coveredLines,
      pct: totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0
    },
    functions: {
      total: totalFunctions,
      covered: coveredFunctions,
      pct: totalFunctions > 0 ? Math.round((coveredFunctions / totalFunctions) * 100) : 0
    },
    branches: {
      total: totalBranches,
      covered: coveredBranches,
      pct: totalBranches > 0 ? Math.round((coveredBranches / totalBranches) * 100) : 0
    },
    statements: {
      total: totalStatements,
      covered: coveredStatements,
      pct: totalStatements > 0 ? Math.round((coveredStatements / totalStatements) * 100) : 0
    }
  };
}

async function archiveTestResults() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `test-results-${timestamp}`;
    
    // Create archive directory
    const archiveDir = path.join(process.cwd(), 'test-archives', archiveName);
    fs.mkdirSync(archiveDir, { recursive: true });

    // Copy test results
    const resultsDirs = ['test-results', 'coverage'];
    
    for (const dir of resultsDirs) {
      const srcDir = path.join(process.cwd(), dir);
      const destDir = path.join(archiveDir, dir);
      
      if (fs.existsSync(srcDir)) {
        fs.cpSync(srcDir, destDir, { recursive: true });
      }
    }

    // Create metadata file
    const metadata = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      gitCommit: process.env.GITHUB_SHA || 'unknown',
      branch: process.env.GITHUB_REF_NAME || 'unknown',
      workflow: process.env.GITHUB_WORKFLOW || 'unknown'
    };

    fs.writeFileSync(
      path.join(archiveDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`📦 Test results archived to: ${archiveDir}`);

  } catch (error) {
    console.log('⚠️  Error archiving test results:', error);
  }
}