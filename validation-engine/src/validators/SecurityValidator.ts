import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ValidationResult, ValidationIssue } from './CodeQualityValidator';

export interface SecurityScanResult extends ValidationResult {
  vulnerabilities: SecurityVulnerability[];
  securityScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityVulnerability {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  file?: string;
  line?: number;
  cwe?: string;
  recommendation: string;
}

export class SecurityValidator {
  private projectPath: string;
  private securityRules: SecurityRule[];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.securityRules = this.loadSecurityRules();
  }

  async validateSecurity(): Promise<SecurityScanResult> {
    const issues: ValidationIssue[] = [];
    const vulnerabilities: SecurityVulnerability[] = [];

    // Run dependency vulnerability scan
    const depVulns = await this.scanDependencies();
    vulnerabilities.push(...depVulns);

    // Scan for code security issues
    const codeVulns = await this.scanCodeSecurity();
    vulnerabilities.push(...codeVulns);

    // Check configuration security
    const configVulns = await this.scanConfiguration();
    vulnerabilities.push(...configVulns);

    // Check for secrets in code
    const secretVulns = await this.scanForSecrets();
    vulnerabilities.push(...secretVulns);

    // Convert vulnerabilities to validation issues
    for (const vuln of vulnerabilities) {
      issues.push({
        type: vuln.severity === 'critical' || vuln.severity === 'high' ? 'error' : 'warning',
        message: `${vuln.title}: ${vuln.description}`,
        file: vuln.file,
        line: vuln.line,
        rule: vuln.id
      });
    }

    const securityScore = this.calculateSecurityScore(vulnerabilities);
    const riskLevel = this.determineRiskLevel(vulnerabilities);
    const passed = riskLevel !== 'critical' && !vulnerabilities.some(v => v.severity === 'critical');

    return {
      passed,
      score: securityScore,
      issues,
      metrics: {
        linesOfCode: 0,
        complexity: 0,
        testCoverage: 0,
        duplicateCode: 0,
        maintainabilityIndex: 0
      },
      vulnerabilities,
      securityScore,
      riskLevel
    };
  }

  private async scanDependencies(): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        // Run npm audit
        const auditOutput = execSync('npm audit --json', {
          cwd: this.projectPath,
          encoding: 'utf8'
        });

        const auditResults = JSON.parse(auditOutput);
        if (auditResults.vulnerabilities) {
          for (const [pkgName, vuln] of Object.entries(auditResults.vulnerabilities) as any) {
            vulnerabilities.push({
              id: `DEP-${pkgName}`,
              title: `Vulnerable dependency: ${pkgName}`,
              severity: this.mapSeverity(vuln.severity),
              description: vuln.title || 'Security vulnerability in dependency',
              recommendation: `Update ${pkgName} to a secure version`
            });
          }
        }
      }
    } catch (error) {
      // npm audit may exit with non-zero code, which is expected
    }

    return vulnerabilities;
  }

  private async scanCodeSecurity(): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const files = this.getAllCodeFiles();

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const relativePath = path.relative(this.projectPath, file);

      // Check for common security anti-patterns
      const securityChecks = [
        {
          pattern: /eval\s*\(/g,
          id: 'CODE-001',
          title: 'Use of eval()',
          severity: 'high' as const,
          description: 'Use of eval() can lead to code injection vulnerabilities',
          recommendation: 'Avoid using eval(). Use JSON.parse() for JSON data or implement safer alternatives'
        },
        {
          pattern: /innerHTML\s*=/g,
          id: 'CODE-002', 
          title: 'Potential XSS via innerHTML',
          severity: 'medium' as const,
          description: 'Setting innerHTML with user data can lead to XSS vulnerabilities',
          recommendation: 'Use textContent or create elements programmatically'
        },
        {
          pattern: /document\.write\s*\(/g,
          id: 'CODE-003',
          title: 'Use of document.write',
          severity: 'medium' as const,
          description: 'document.write can be exploited for XSS attacks',
          recommendation: 'Use DOM manipulation methods instead'
        },
        {
          pattern: /crypto\.createHash\s*\(\s*['"]md5['"]|crypto\.createHash\s*\(\s*['"]sha1['"]/g,
          id: 'CODE-004',
          title: 'Weak cryptographic hash',
          severity: 'medium' as const,
          description: 'MD5 and SHA1 are cryptographically weak hash functions',
          recommendation: 'Use SHA-256 or stronger hash functions'
        },
        {
          pattern: /password\s*=\s*['"][^'"]*['"]|token\s*=\s*['"][^'"]*['"]/gi,
          id: 'CODE-005',
          title: 'Hardcoded credentials',
          severity: 'critical' as const,
          description: 'Hardcoded passwords or tokens found in source code',
          recommendation: 'Use environment variables or secure secret management'
        }
      ];

      for (const check of securityChecks) {
        const matches = content.matchAll(check.pattern);
        for (const match of matches) {
          const lineNumber = content.substring(0, match.index).split('\n').length;
          vulnerabilities.push({
            ...check,
            file: relativePath,
            line: lineNumber
          });
        }
      }
    }

    return vulnerabilities;
  }

  private async scanConfiguration(): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check Docker configurations
    const dockerfilePath = path.join(this.projectPath, 'Dockerfile');
    if (fs.existsSync(dockerfilePath)) {
      const content = fs.readFileSync(dockerfilePath, 'utf8');
      
      if (content.includes('USER root') || !content.includes('USER ')) {
        vulnerabilities.push({
          id: 'CONFIG-001',
          title: 'Docker running as root',
          severity: 'medium',
          description: 'Container may be running as root user',
          file: 'Dockerfile',
          recommendation: 'Add USER directive to run as non-root user'
        });
      }
    }

    // Check for exposed sensitive ports
    const composeFiles = ['docker-compose.yml', 'docker-compose.yaml'];
    for (const file of composeFiles) {
      const composePath = path.join(this.projectPath, file);
      if (fs.existsSync(composePath)) {
        const content = fs.readFileSync(composePath, 'utf8');
        
        // Check for database ports exposed to host
        if (content.match(/5432:5432|3306:3306|27017:27017/)) {
          vulnerabilities.push({
            id: 'CONFIG-002',
            title: 'Database port exposed',
            severity: 'medium',
            description: 'Database port is exposed to host network',
            file,
            recommendation: 'Remove port mapping for database services or restrict access'
          });
        }
      }
    }

    return vulnerabilities;
  }

  private async scanForSecrets(): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const files = this.getAllCodeFiles();

    const secretPatterns = [
      {
        pattern: /AKIA[0-9A-Z]{16}/g,
        type: 'AWS Access Key'
      },
      {
        pattern: /AIza[0-9A-Za-z\\-_]{35}/g,
        type: 'Google API Key'
      },
      {
        pattern: /sk-[a-zA-Z0-9]{48}/g,
        type: 'OpenAI API Key'
      },
      {
        pattern: /ghp_[a-zA-Z0-9]{36}/g,
        type: 'GitHub Personal Access Token'
      },
      {
        pattern: /xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}/g,
        type: 'Slack Bot Token'
      }
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const relativePath = path.relative(this.projectPath, file);

      for (const { pattern, type } of secretPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          const lineNumber = content.substring(0, match.index).split('\n').length;
          vulnerabilities.push({
            id: 'SECRET-001',
            title: `Exposed ${type}`,
            severity: 'critical',
            description: `${type} found in source code`,
            file: relativePath,
            line: lineNumber,
            recommendation: 'Remove secret from code and use environment variables or secret management service'
          });
        }
      }
    }

    return vulnerabilities;
  }

  private calculateSecurityScore(vulnerabilities: SecurityVulnerability[]): number {
    let score = 100;

    for (const vuln of vulnerabilities) {
      switch (vuln.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    return Math.max(0, score);
  }

  private determineRiskLevel(vulnerabilities: SecurityVulnerability[]): 'low' | 'medium' | 'high' | 'critical' {
    const hasCritical = vulnerabilities.some(v => v.severity === 'critical');
    const hasHigh = vulnerabilities.some(v => v.severity === 'high');
    const mediumCount = vulnerabilities.filter(v => v.severity === 'medium').length;

    if (hasCritical) return 'critical';
    if (hasHigh) return 'high';
    if (mediumCount > 5) return 'high';
    if (mediumCount > 0) return 'medium';
    return 'low';
  }

  private mapSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'moderate':
      case 'medium':
        return 'medium';
      default:
        return 'low';
    }
  }

  private getAllCodeFiles(): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.yaml', '.yml', '.json'];

    function walk(dir: string) {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          walk(fullPath);
        } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }

    walk(this.projectPath);
    return files;
  }

  private loadSecurityRules(): SecurityRule[] {
    return [
      {
        id: 'OWASP-A01',
        name: 'Injection Prevention',
        description: 'Check for SQL injection and code injection vulnerabilities'
      },
      {
        id: 'OWASP-A02',
        name: 'Broken Authentication',
        description: 'Verify authentication and session management'
      },
      {
        id: 'OWASP-A03',
        name: 'Sensitive Data Exposure',
        description: 'Check for exposed sensitive data'
      }
    ];
  }
}

interface SecurityRule {
  id: string;
  name: string;
  description: string;
}

export default SecurityValidator;