#!/usr/bin/env node

/**
 * SLO Processor for CI/CD Pipeline
 * Validates Service Level Objectives against Prometheus metrics
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const axios = require('axios');

class SLOProcessor {
  constructor(configPath = 'tests/performance/slo-validation.yml') {
    this.config = this.loadConfig(configPath);
    this.prometheus = this.initPrometheus();
    this.results = {
      timestamp: new Date().toISOString(),
      slos: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      },
      rollback_required: false,
      failed_critical_slos: []
    };
  }

  loadConfig(configPath) {
    try {
      const configFile = fs.readFileSync(configPath, 'utf8');
      return yaml.load(configFile);
    } catch (error) {
      console.error(`Failed to load SLO configuration: ${error.message}`);
      process.exit(1);
    }
  }

  initPrometheus() {
    const baseURL = process.env.PROMETHEUS_URL;
    const authToken = process.env.PROMETHEUS_TOKEN;

    if (!baseURL) {
      console.error('PROMETHEUS_URL environment variable is required');
      process.exit(1);
    }

    const headers = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    return axios.create({
      baseURL,
      headers,
      timeout: parseInt(this.config.measurement?.timeout?.replace('s', '')) * 1000 || 30000
    });
  }

  async queryPrometheus(query) {
    try {
      const response = await this.prometheus.get('/api/v1/query', {
        params: { query }
      });

      if (response.data.status !== 'success') {
        throw new Error(`Prometheus query failed: ${response.data.error}`);
      }

      const result = response.data.data.result;
      if (result.length === 0) {
        console.warn(`No data returned for query: ${query}`);
        return null;
      }

      return parseFloat(result[0].value[1]);
    } catch (error) {
      console.error(`Prometheus query error: ${error.message}`);
      return null;
    }
  }

  async validateSLO(serviceName, sloName, sloConfig) {
    console.log(`📊 Validating ${serviceName}.${sloName}...`);

    const value = await this.queryPrometheus(sloConfig.query);
    if (value === null) {
      return {
        status: 'error',
        message: 'Failed to retrieve metric value'
      };
    }

    const threshold = sloConfig.threshold;
    const passed = this.checkThreshold(value, threshold, sloConfig);
    
    const result = {
      status: passed ? 'pass' : 'fail',
      value,
      threshold,
      measurement_window: sloConfig.measurement_window,
      query: sloConfig.query
    };

    if (passed) {
      console.log(`✅ ${serviceName}.${sloName}: ${value} (threshold: ${threshold})`);
    } else {
      console.log(`❌ ${serviceName}.${sloName}: ${value} (threshold: ${threshold})`);
      
      // Check if this is a critical SLO that should trigger rollback
      const sloKey = `${serviceName}.${sloName}`;
      if (this.config.rollback_triggers?.critical?.includes(sloKey)) {
        this.results.rollback_required = true;
        this.results.failed_critical_slos.push(sloKey);
      }
    }

    return result;
  }

  checkThreshold(value, threshold, sloConfig) {
    // For availability and success rates, higher is better
    if (sloConfig.query.includes('availability') || 
        sloConfig.query.includes('success_rate') ||
        sloConfig.query.includes('satisfaction')) {
      return value >= threshold;
    }
    
    // For latency, error rates, and utilization, lower is better
    if (sloConfig.query.includes('latency') || 
        sloConfig.query.includes('error') ||
        sloConfig.query.includes('utilization')) {
      return value <= threshold;
    }
    
    // Default: higher is better
    return value >= threshold;
  }

  async validateAllSLOs() {
    console.log('🔍 Starting SLO validation...\n');

    for (const [serviceName, slos] of Object.entries(this.config.slos)) {
      console.log(`📋 Validating ${serviceName} SLOs:`);
      
      this.results.slos[serviceName] = {};
      
      for (const [sloName, sloConfig] of Object.entries(slos)) {
        const result = await this.validateSLO(serviceName, sloName, sloConfig);
        this.results.slos[serviceName][sloName] = result;
        
        this.results.summary.total++;
        if (result.status === 'pass') {
          this.results.summary.passed++;
        } else if (result.status === 'fail') {
          this.results.summary.failed++;
        } else {
          this.results.summary.warnings++;
        }
      }
      
      console.log(''); // Empty line for readability
    }
  }

  generateSummary() {
    const { summary, rollback_required, failed_critical_slos } = this.results;
    
    console.log('📈 SLO Validation Summary:');
    console.log(`   Total SLOs: ${summary.total}`);
    console.log(`   Passed: ${summary.passed} ✅`);
    console.log(`   Failed: ${summary.failed} ❌`);
    console.log(`   Warnings: ${summary.warnings} ⚠️`);
    
    if (rollback_required) {
      console.log('\n🚨 ROLLBACK REQUIRED!');
      console.log(`   Critical SLO failures: ${failed_critical_slos.join(', ')}`);
      console.log('   Deployment should be rolled back immediately.');
    } else if (summary.failed > 0) {
      console.log('\n⚠️  Some SLOs failed but no rollback required');
      console.log('   Monitor closely and investigate failures');
    } else {
      console.log('\n✅ All SLOs passed! Deployment is healthy.');
    }
  }

  async generateReport() {
    const reportPath = process.env.SLO_REPORT_PATH || 'slo-validation-report.json';
    
    // Add error budget calculation
    this.results.error_budget = await this.calculateErrorBudget();
    
    // Add recommendations
    this.results.recommendations = this.generateRecommendations();
    
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);
    
    return this.results;
  }

  async calculateErrorBudget() {
    const errorBudget = {};
    
    // Calculate error budget for availability SLOs
    for (const [serviceName, slos] of Object.entries(this.config.slos)) {
      if (slos.availability) {
        const slo = slos.availability;
        const currentValue = this.results.slos[serviceName]?.availability?.value;
        
        if (currentValue !== undefined) {
          const availabilityTarget = slo.threshold / 100; // Convert percentage to decimal
          const currentAvailability = currentValue / 100;
          const errorBudgetTarget = 1 - availabilityTarget;
          const currentErrorRate = 1 - currentAvailability;
          const budgetConsumed = (currentErrorRate / errorBudgetTarget) * 100;
          
          errorBudget[serviceName] = {
            target_availability: availabilityTarget,
            current_availability: currentAvailability,
            error_budget_target: errorBudgetTarget,
            current_error_rate: currentErrorRate,
            budget_consumed_percent: Math.min(budgetConsumed, 100),
            remaining_budget_percent: Math.max(100 - budgetConsumed, 0)
          };
        }
      }
    }
    
    return errorBudget;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Check for performance issues
    for (const [serviceName, slos] of Object.entries(this.results.slos)) {
      for (const [sloName, result] of Object.entries(slos)) {
        if (result.status === 'fail') {
          if (sloName.includes('latency')) {
            recommendations.push({
              type: 'performance',
              severity: 'high',
              service: serviceName,
              issue: `High latency detected (${result.value}ms > ${result.threshold}ms)`,
              suggestions: [
                'Check for database query optimization opportunities',
                'Review recent code changes for performance regressions',
                'Consider scaling up resources or adding cache layers',
                'Analyze APM traces for bottlenecks'
              ]
            });
          } else if (sloName.includes('error')) {
            recommendations.push({
              type: 'reliability',
              severity: 'critical',
              service: serviceName,
              issue: `High error rate detected (${result.value}% > ${result.threshold}%)`,
              suggestions: [
                'Review recent deployments for breaking changes',
                'Check application logs for error patterns',
                'Verify external dependencies are healthy',
                'Consider rolling back to previous stable version'
              ]
            });
          } else if (sloName.includes('availability')) {
            recommendations.push({
              type: 'availability',
              severity: 'critical',
              service: serviceName,
              issue: `Low availability detected (${result.value}% < ${result.threshold}%)`,
              suggestions: [
                'Check service health endpoints',
                'Verify load balancer configuration',
                'Review infrastructure capacity and scaling policies',
                'Investigate potential resource exhaustion'
              ]
            });
          }
        }
      }
    }
    
    return recommendations;
  }

  async sendAlerts() {
    if (this.results.summary.failed === 0) {
      return;
    }

    const alertConfig = this.config.alerts;
    if (!alertConfig) {
      return;
    }

    // Send Slack notification
    if (alertConfig.slack_webhook && process.env.SLACK_WEBHOOK_URL) {
      await this.sendSlackAlert();
    }

    // Send email notifications would go here
    // Implementation depends on email service being used
  }

  async sendSlackAlert() {
    try {
      const webhook = process.env.SLACK_WEBHOOK_URL;
      const { summary, rollback_required, failed_critical_slos } = this.results;
      
      let color = 'warning';
      let title = '⚠️ SLO Validation Issues Detected';
      
      if (rollback_required) {
        color = 'danger';
        title = '🚨 Critical SLO Breach - Rollback Required';
      }
      
      const payload = {
        attachments: [{
          color,
          title,
          fields: [
            {
              title: 'Summary',
              value: `Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed}`,
              short: true
            }
          ],
          footer: 'SLO Validation',
          ts: Math.floor(Date.now() / 1000)
        }]
      };
      
      if (rollback_required) {
        payload.attachments[0].fields.push({
          title: 'Failed Critical SLOs',
          value: failed_critical_slos.join('\n'),
          short: false
        });
      }
      
      await axios.post(webhook, payload);
      console.log('📱 Slack notification sent');
    } catch (error) {
      console.error(`Failed to send Slack alert: ${error.message}`);
    }
  }
}

// CLI execution
async function main() {
  const processor = new SLOProcessor();
  
  try {
    await processor.validateAllSLOs();
    processor.generateSummary();
    await processor.generateReport();
    await processor.sendAlerts();
    
    // Exit with appropriate code
    if (processor.results.rollback_required) {
      process.exit(2); // Rollback required
    } else if (processor.results.summary.failed > 0) {
      process.exit(1); // SLO failures but no rollback
    } else {
      process.exit(0); // All good
    }
  } catch (error) {
    console.error(`SLO validation failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SLOProcessor;