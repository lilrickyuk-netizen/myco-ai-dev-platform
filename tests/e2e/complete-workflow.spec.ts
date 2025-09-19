/**
 * End-to-End Test Suite for AI Development Platform
 * Tests complete user workflow: create → run → deploy project
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  apiUrl: process.env.TEST_API_URL || 'http://localhost:3001',
  timeout: 60000,
  slowMo: process.env.CI ? 0 : 100,
  headless: process.env.CI ? true : false
};

// Test user credentials
const TEST_USER = {
  email: `test-user-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'Test User'
};

// Project configuration for testing
const TEST_PROJECT = {
  name: `test-project-${Date.now()}`,
  description: 'End-to-end test project',
  template: 'react-typescript',
  language: 'typescript'
};

test.describe('AI Development Platform - Complete Workflow', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(TEST_CONFIG.baseUrl);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.describe('User Authentication Flow', () => {
    test('should display landing page correctly', async () => {
      await expect(page).toHaveTitle(/AI Development Platform/);
      await expect(page.locator('h1')).toContainText('AI Development Platform');
      
      // Check for key elements
      await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="signup-button"]')).toBeVisible();
    });

    test('should allow user registration', async () => {
      // Click sign up button
      await page.click('[data-testid="signup-button"]');
      
      // Fill registration form
      await page.fill('[data-testid="signup-email"]', TEST_USER.email);
      await page.fill('[data-testid="signup-password"]', TEST_USER.password);
      await page.fill('[data-testid="signup-name"]', TEST_USER.name);
      
      // Submit registration
      await page.click('[data-testid="signup-submit"]');
      
      // Wait for successful registration
      await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    });

    test('should navigate to dashboard after registration', async () => {
      await expect(page).toHaveURL(new RegExp('/dashboard'));
      await expect(page.locator('[data-testid="user-profile"]')).toContainText(TEST_USER.name);
      
      // Check dashboard elements
      await expect(page.locator('[data-testid="create-project-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="projects-list"]')).toBeVisible();
    });
  });

  test.describe('Project Creation and Management', () => {
    test('should create a new project', async () => {
      // Click create project button
      await page.click('[data-testid="create-project-button"]');
      
      // Wait for create project modal
      await expect(page.locator('[data-testid="create-project-modal"]')).toBeVisible();
      
      // Fill project details
      await page.fill('[data-testid="project-name"]', TEST_PROJECT.name);
      await page.fill('[data-testid="project-description"]', TEST_PROJECT.description);
      
      // Select template
      await page.click('[data-testid="template-selector"]');
      await page.click(`[data-testid="template-${TEST_PROJECT.template}"]`);
      
      // Create project
      await page.click('[data-testid="create-project-submit"]');
      
      // Wait for project creation and navigation to IDE
      await expect(page.locator('[data-testid="ide-container"]')).toBeVisible({ timeout: 15000 });
      await expect(page).toHaveURL(new RegExp(`/projects/${TEST_PROJECT.name}`));
    });

    test('should display project IDE interface', async () => {
      // Check IDE components
      await expect(page.locator('[data-testid="file-explorer"]')).toBeVisible();
      await expect(page.locator('[data-testid="code-editor"]')).toBeVisible();
      await expect(page.locator('[data-testid="terminal"]')).toBeVisible();
      await expect(page.locator('[data-testid="ai-assistant"]')).toBeVisible();
      
      // Check file explorer has initial files
      await expect(page.locator('[data-testid="file-explorer"] [data-testid="file-item"]')).toHaveCount.atLeast(1);
    });

    test('should load project files in editor', async () => {
      // Click on a file in file explorer
      const firstFile = page.locator('[data-testid="file-explorer"] [data-testid="file-item"]').first();
      await firstFile.click();
      
      // Verify editor loads file content
      await expect(page.locator('[data-testid="code-editor"]')).not.toBeEmpty();
      
      // Check syntax highlighting is working
      await expect(page.locator('[data-testid="code-editor"] .monaco-editor')).toBeVisible();
    });
  });

  test.describe('AI Assistant Integration', () => {
    test('should interact with AI assistant', async () => {
      // Open AI assistant panel
      await page.click('[data-testid="ai-assistant-toggle"]');
      await expect(page.locator('[data-testid="ai-chat-container"]')).toBeVisible();
      
      // Send a message to AI
      const testMessage = 'Help me create a simple React component';
      await page.fill('[data-testid="ai-chat-input"]', testMessage);
      await page.click('[data-testid="ai-chat-send"]');
      
      // Wait for AI response
      await expect(page.locator('[data-testid="ai-message"]').last()).toBeVisible({ timeout: 30000 });
      
      // Verify response contains code
      const aiResponse = await page.locator('[data-testid="ai-message"]').last().textContent();
      expect(aiResponse).toMatch(/(component|function|jsx|tsx)/i);
    });

    test('should apply AI suggestions to code', async () => {
      // Look for apply button in AI response
      const applyButton = page.locator('[data-testid="apply-ai-suggestion"]').last();
      
      if (await applyButton.isVisible()) {
        await applyButton.click();
        
        // Verify code was applied to editor
        await expect(page.locator('[data-testid="code-editor"]')).toContainText('component');
      }
    });
  });

  test.describe('Code Execution and Testing', () => {
    test('should execute code in terminal', async () => {
      // Focus terminal
      await page.click('[data-testid="terminal"]');
      
      // Execute a simple command
      await page.keyboard.type('npm --version');
      await page.keyboard.press('Enter');
      
      // Wait for command output
      await expect(page.locator('[data-testid="terminal-output"]')).toContainText(/\d+\.\d+\.\d+/, { timeout: 10000 });
    });

    test('should run project build', async () => {
      // Click run/build button
      await page.click('[data-testid="run-project-button"]');
      
      // Wait for build to start
      await expect(page.locator('[data-testid="build-status"]')).toContainText('Building...', { timeout: 5000 });
      
      // Wait for build to complete
      await expect(page.locator('[data-testid="build-status"]')).toContainText(/Build (completed|successful)/, { timeout: 60000 });
    });

    test('should preview running application', async () => {
      // Check if preview is available
      const previewButton = page.locator('[data-testid="preview-button"]');
      
      if (await previewButton.isVisible()) {
        await previewButton.click();
        
        // Wait for preview iframe or new tab
        const previewFrame = page.locator('[data-testid="preview-iframe"]');
        if (await previewFrame.isVisible()) {
          await expect(previewFrame).toBeVisible();
        }
      }
    });
  });

  test.describe('Project Collaboration and Sharing', () => {
    test('should save project changes', async () => {
      // Make a change in the editor
      await page.click('[data-testid="code-editor"]');
      await page.keyboard.press('End');
      await page.keyboard.type('\n// Test comment added');
      
      // Save the file
      await page.keyboard.press('Control+S');
      
      // Verify save indication
      await expect(page.locator('[data-testid="save-status"]')).toContainText(/saved|updated/i, { timeout: 5000 });
    });

    test('should share project', async () => {
      // Open share modal
      await page.click('[data-testid="share-project-button"]');
      await expect(page.locator('[data-testid="share-modal"]')).toBeVisible();
      
      // Generate share link
      await page.click('[data-testid="generate-share-link"]');
      
      // Copy share link
      const shareLink = await page.locator('[data-testid="share-link"]').textContent();
      expect(shareLink).toMatch(/^https?:\/\/.+/);
    });
  });

  test.describe('Deployment Workflow', () => {
    test('should access deployment settings', async () => {
      // Open deployment panel
      await page.click('[data-testid="deploy-button"]');
      await expect(page.locator('[data-testid="deployment-modal"]')).toBeVisible();
      
      // Check deployment options
      await expect(page.locator('[data-testid="deployment-platform-selector"]')).toBeVisible();
      await expect(page.locator('[data-testid="deployment-config"]')).toBeVisible();
    });

    test('should configure deployment settings', async () => {
      // Select deployment platform
      await page.click('[data-testid="deployment-platform-selector"]');
      await page.click('[data-testid="platform-vercel"]'); // or another platform
      
      // Configure deployment settings
      const deploymentName = `${TEST_PROJECT.name}-deploy`;
      await page.fill('[data-testid="deployment-name"]', deploymentName);
      
      // Set environment variables if needed
      const envVarSection = page.locator('[data-testid="environment-variables"]');
      if (await envVarSection.isVisible()) {
        await page.click('[data-testid="add-env-var"]');
        await page.fill('[data-testid="env-var-key"]', 'NODE_ENV');
        await page.fill('[data-testid="env-var-value"]', 'production');
      }
    });

    test('should initiate deployment', async () => {
      // Start deployment
      await page.click('[data-testid="start-deployment"]');
      
      // Wait for deployment to start
      await expect(page.locator('[data-testid="deployment-status"]')).toContainText('Deploying...', { timeout: 10000 });
      
      // Monitor deployment progress
      const deploymentProgress = page.locator('[data-testid="deployment-progress"]');
      await expect(deploymentProgress).toBeVisible();
      
      // Wait for deployment completion (with longer timeout)
      await expect(page.locator('[data-testid="deployment-status"]')).toContainText(/deployed|success/i, { timeout: 300000 });
    });

    test('should verify deployed application', async () => {
      // Get deployment URL
      const deploymentUrl = await page.locator('[data-testid="deployment-url"]').textContent();
      expect(deploymentUrl).toMatch(/^https?:\/\/.+/);
      
      // Open deployment URL in new tab
      const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        page.click('[data-testid="open-deployment"]')
      ]);
      
      // Verify deployed app loads
      await expect(newPage).toHaveTitle(/.*/, { timeout: 30000 });
      
      await newPage.close();
    });
  });

  test.describe('Project Management and Cleanup', () => {
    test('should return to dashboard', async () => {
      // Navigate back to dashboard
      await page.click('[data-testid="dashboard-link"]');
      await expect(page).toHaveURL(new RegExp('/dashboard'));
      
      // Verify project appears in projects list
      await expect(page.locator(`[data-testid="project-${TEST_PROJECT.name}"]`)).toBeVisible();
    });

    test('should view project analytics', async () => {
      // Click on project analytics
      await page.click(`[data-testid="project-${TEST_PROJECT.name}"] [data-testid="analytics-button"]`);
      
      // Verify analytics panel
      await expect(page.locator('[data-testid="analytics-panel"]')).toBeVisible();
      
      // Check for metrics
      await expect(page.locator('[data-testid="project-views"]')).toBeVisible();
      await expect(page.locator('[data-testid="deployment-count"]')).toBeVisible();
    });

    test('should delete test project', async () => {
      // Navigate to project settings
      await page.click(`[data-testid="project-${TEST_PROJECT.name}"] [data-testid="settings-button"]`);
      
      // Click delete project
      await page.click('[data-testid="delete-project-button"]');
      
      // Confirm deletion
      await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
      await page.fill('[data-testid="delete-confirmation-input"]', TEST_PROJECT.name);
      await page.click('[data-testid="confirm-delete"]');
      
      // Verify project is removed
      await expect(page.locator(`[data-testid="project-${TEST_PROJECT.name}"]`)).not.toBeVisible();
    });
  });

  test.describe('Performance and Accessibility', () => {
    test('should meet performance benchmarks', async () => {
      // Navigate to main dashboard
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      
      // Measure page load time
      const startTime = Date.now();
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Assert reasonable load time (adjust threshold as needed)
      expect(loadTime).toBeLessThan(5000);
    });

    test('should be accessible', async () => {
      // Check for basic accessibility features
      await expect(page.locator('[role="main"]')).toBeVisible();
      await expect(page.locator('[aria-label]')).toHaveCount.atLeast(1);
      
      // Check for keyboard navigation
      await page.keyboard.press('Tab');
      const focusedElement = await page.locator(':focus').getAttribute('data-testid');
      expect(focusedElement).toBeTruthy();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async () => {
      // Simulate network failure
      await page.route('**/api/**', route => route.abort());
      
      // Try to perform an action that requires API
      await page.click('[data-testid="create-project-button"]');
      
      // Check for error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 10000 });
      
      // Restore network
      await page.unroute('**/api/**');
    });

    test('should handle invalid project names', async () => {
      // Try to create project with invalid name
      await page.click('[data-testid="create-project-button"]');
      await page.fill('[data-testid="project-name"]', 'invalid name with spaces and special chars!@#');
      await page.click('[data-testid="create-project-submit"]');
      
      // Check for validation error
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
    });
  });
});

// Utility functions for tests
export class TestUtils {
  static async waitForApiResponse(page: Page, url: string, timeout = 30000) {
    const response = await page.waitForResponse(
      response => response.url().includes(url) && response.status() === 200,
      { timeout }
    );
    return response;
  }

  static async takeScreenshot(page: Page, name: string) {
    await page.screenshot({ 
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  static async getConsoleErrors(page: Page): Promise<string[]> {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    return errors;
  }

  static async checkNetworkRequests(page: Page, pattern: string): Promise<boolean> {
    let requestFound = false;
    
    page.on('request', request => {
      if (request.url().includes(pattern)) {
        requestFound = true;
      }
    });
    
    return requestFound;
  }
}