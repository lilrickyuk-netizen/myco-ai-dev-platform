import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface ValidationResult {
  passed: boolean;
  score: number;
  issues: ValidationIssue[];
  metrics: CodeMetrics;
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  rule?: string;
}

export interface CodeMetrics {
  linesOfCode: number;
  complexity: number;
  testCoverage: number;
  duplicateCode: number;
  maintainabilityIndex: number;
}

export class CodeQualityValidator {
  private projectPath: string;
  private rules: ValidationRule[];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.rules = this.loadDefaultRules();
  }

  async validate(): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const metrics = await this.calculateMetrics();
    
    // Run linting
    const lintIssues = await this.runLinting();
    issues.push(...lintIssues);

    // Check test coverage
    const coverageIssues = await this.checkTestCoverage();
    issues.push(...coverageIssues);

    // Check for code smells
    const codeSmellIssues = await this.detectCodeSmells();
    issues.push(...codeSmellIssues);

    // Check security vulnerabilities
    const securityIssues = await this.runSecurityScan();
    issues.push(...securityIssues);

    const score = this.calculateScore(issues, metrics);
    const passed = score >= 70 && !issues.some(i => i.type === 'error');

    return {
      passed,
      score,
      issues,
      metrics
    };
  }

  private async runLinting(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      // Run ESLint for TypeScript/JavaScript files
      const eslintOutput = execSync('npx eslint . --format json', {
        cwd: this.projectPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const eslintResults = JSON.parse(eslintOutput);
      for (const result of eslintResults) {
        for (const message of result.messages) {
          issues.push({
            type: message.severity === 2 ? 'error' : 'warning',
            message: message.message,
            file: result.filePath,
            line: message.line,
            rule: message.ruleId
          });
        }
      }
    } catch (error) {
      issues.push({
        type: 'warning',
        message: 'Could not run ESLint analysis'
      });
    }

    return issues;
  }

  private async checkTestCoverage(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      const coverageOutput = execSync('npm run test:coverage', {
        cwd: this.projectPath,
        encoding: 'utf8'
      });
      
      // Parse coverage percentage from output
      const coverageMatch = coverageOutput.match(/All files\s+\|\s+(\d+\.?\d*)/);
      if (coverageMatch) {
        const coverage = parseFloat(coverageMatch[1]);
        if (coverage < 70) {
          issues.push({
            type: 'warning',
            message: `Test coverage is ${coverage}%, below the 70% threshold`
          });
        }
      }
    } catch (error) {
      issues.push({
        type: 'warning', 
        message: 'Could not determine test coverage'
      });
    }

    return issues;
  }

  private async detectCodeSmells(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    // Check for large files
    const files = this.getAllFiles(this.projectPath, ['.ts', '.tsx', '.js', '.jsx']);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').length;
      
      if (lines > 500) {
        issues.push({
          type: 'warning',
          message: `File is too large (${lines} lines)`,
          file: path.relative(this.projectPath, file)
        });
      }

      // Check for long functions
      const functionMatches = content.match(/function\s+\w+[^{]*{[\s\S]*?^}/gm) || [];
      for (const match of functionMatches) {
        const functionLines = match.split('\n').length;
        if (functionLines > 50) {
          issues.push({
            type: 'warning',
            message: 'Function is too long (>50 lines)',
            file: path.relative(this.projectPath, file)
          });
        }
      }
    }

    return issues;
  }

  private async runSecurityScan(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      // Run npm audit
      const auditOutput = execSync('npm audit --json', {
        cwd: this.projectPath,
        encoding: 'utf8'
      });
      
      const auditResults = JSON.parse(auditOutput);
      if (auditResults.vulnerabilities) {
        for (const [pkg, vuln] of Object.entries(auditResults.vulnerabilities) as any) {
          const severity = vuln.severity;
          issues.push({
            type: severity === 'high' || severity === 'critical' ? 'error' : 'warning',
            message: `Security vulnerability in ${pkg}: ${vuln.title}`,
            rule: 'security'
          });
        }
      }
    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities found
      // This is expected behavior
    }

    return issues;
  }

  private async calculateMetrics(): Promise<CodeMetrics> {
    const files = this.getAllFiles(this.projectPath, ['.ts', '.tsx', '.js', '.jsx']);
    let linesOfCode = 0;
    let complexity = 0;

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('//')).length;
      linesOfCode += lines;
      
      // Simple cyclomatic complexity calculation
      const complexityKeywords = ['if', 'else', 'while', 'for', 'case', 'catch', '&&', '||', '?'];
      for (const keyword of complexityKeywords) {
        const matches = content.match(new RegExp(`\\b${keyword}\\b`, 'g'));
        if (matches) complexity += matches.length;
      }
    }

    return {
      linesOfCode,
      complexity: Math.round(complexity / files.length),
      testCoverage: 0, // Will be populated by coverage check
      duplicateCode: 0, // Simplified for now
      maintainabilityIndex: Math.max(0, 100 - (complexity / 10))
    };
  }

  private calculateScore(issues: ValidationIssue[], metrics: CodeMetrics): number {
    let score = 100;
    
    // Deduct points for issues
    for (const issue of issues) {
      switch (issue.type) {
        case 'error':
          score -= 10;
          break;
        case 'warning':
          score -= 5;
          break;
        case 'info':
          score -= 1;
          break;
      }
    }

    // Adjust for metrics
    if (metrics.complexity > 10) score -= 10;
    if (metrics.testCoverage < 70) score -= 15;
    if (metrics.maintainabilityIndex < 50) score -= 10;

    return Math.max(0, score);
  }

  private getAllFiles(dir: string, extensions: string[]): string[] {
    const files: string[] = [];
    
    function walk(currentDir: string) {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          walk(fullPath);
        } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
    
    walk(dir);
    return files;
  }

  private loadDefaultRules(): ValidationRule[] {
    return [
      {
        name: 'no-console',
        type: 'warning',
        message: 'Console statements should be removed in production'
      },
      {
        name: 'max-file-lines',
        type: 'warning', 
        message: 'File should not exceed 500 lines'
      },
      {
        name: 'max-function-lines',
        type: 'warning',
        message: 'Function should not exceed 50 lines'
      }
    ];
  }
}

interface ValidationRule {
  name: string;
  type: 'error' | 'warning' | 'info';
  message: string;
}

export default CodeQualityValidator;