import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should redirect to sign in when not authenticated', async ({ page }) => {
    await page.goto('/');
    
    // Should be redirected to Clerk sign-in
    await expect(page).toHaveURL(/.*sign-in.*/);
  });

  test('should show dashboard after sign in', async ({ page }) => {
    // Mock Clerk authentication for testing
    await page.addInitScript(() => {
      // Mock Clerk globals
      (window as any).__clerk_publishable_key = 'pk_test_mock_key_for_testing';
      (window as any).__clerk_frontend_api = 'clerk.mock.test';
    });

    await page.goto('/');
    
    // In a real test, you would handle the actual sign-in flow
    // For this example, we'll assume we're authenticated
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
    
    await expect(page.locator('h1')).toContainText('Projects');
  });
});

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      (window as any).__clerk_publishable_key = 'pk_test_mock_key_for_testing';
    });
    
    await page.goto('/');
  });

  test('should be able to create a new project', async ({ page }) => {
    // Click the "Create Project" button
    await page.click('[data-testid="create-project-button"]');
    
    // Fill in project details
    await page.fill('[data-testid="project-name-input"]', 'Test Project');
    await page.fill('[data-testid="project-description-input"]', 'A test project');
    
    // Select template
    await page.click('[data-testid="template-react-typescript"]');
    
    // Create project
    await page.click('[data-testid="create-project-submit"]');
    
    // Should navigate to IDE
    await expect(page).toHaveURL(/.*\/ide\/.*/);
  });

  test('should show project list', async ({ page }) => {
    await page.waitForSelector('[data-testid="project-grid"]');
    
    // Should show projects or empty state
    const projectGrid = page.locator('[data-testid="project-grid"]');
    await expect(projectGrid).toBeVisible();
  });
});

test.describe('IDE Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication and navigate to IDE
    await page.addInitScript(() => {
      (window as any).__clerk_publishable_key = 'pk_test_mock_key_for_testing';
    });
    
    // Assuming we have a test project with ID 'test-project'
    await page.goto('/ide/test-project');
  });

  test('should load IDE interface', async ({ page }) => {
    // Wait for IDE to load
    await page.waitForSelector('[data-testid="file-explorer"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="code-editor"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="terminal"]', { timeout: 10000 });
    
    // Check that all main panels are visible
    await expect(page.locator('[data-testid="file-explorer"]')).toBeVisible();
    await expect(page.locator('[data-testid="code-editor"]')).toBeVisible();
    await expect(page.locator('[data-testid="terminal"]')).toBeVisible();
  });

  test('should be able to navigate files', async ({ page }) => {
    await page.waitForSelector('[data-testid="file-explorer"]');
    
    // Click on a file in the explorer
    const firstFile = page.locator('[data-testid="file-item"]').first();
    if (await firstFile.count() > 0) {
      await firstFile.click();
      
      // File should open in editor
      await expect(page.locator('[data-testid="code-editor"]')).toBeVisible();
    }
  });

  test('should be able to save files', async ({ page }) => {
    await page.waitForSelector('[data-testid="code-editor"]');
    
    // Make some changes to trigger save
    await page.click('[data-testid="save-button"]');
    
    // Should show save success
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
  });
});