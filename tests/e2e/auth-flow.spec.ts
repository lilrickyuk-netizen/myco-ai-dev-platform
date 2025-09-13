import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('should redirect to sign in when not authenticated', async ({ page }) => {
    // Should be redirected to Clerk sign-in
    await expect(page).toHaveURL(/sign-in/);
  });

  test('should show dashboard after sign in', async ({ page }) => {
    // Mock authentication for testing
    await page.addInitScript(() => {
      // Mock Clerk authentication
      window.localStorage.setItem('test-auth', 'true');
    });

    await page.goto('/');
    
    // Should show dashboard
    await expect(page.locator('text=Myco AI Platform')).toBeVisible();
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });

  test('should be able to create a new project', async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      window.localStorage.setItem('test-auth', 'true');
    });

    await page.goto('/');
    
    // Click new project button
    await page.click('text=New Project');
    
    // Should open create project dialog
    await expect(page.locator('text=Create New Project')).toBeVisible();
    
    // Fill in project details
    await page.fill('[placeholder="Enter project name"]', 'Test Project');
    await page.fill('[placeholder="Project description"]', 'A test project');
    
    // Select template
    await page.click('text=Select Template');
    await page.click('text=React TypeScript');
    
    // Create project
    await page.click('text=Create Project');
    
    // Should show success message
    await expect(page.locator('text=Project created successfully')).toBeVisible();
  });

  test('should be able to navigate to IDE', async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      window.localStorage.setItem('test-auth', 'true');
    });

    await page.goto('/');
    
    // Assuming there's a project card to click
    await page.click('[data-testid="project-card"]:first-child');
    
    // Should navigate to IDE
    await expect(page).toHaveURL(/\/ide\//);
    await expect(page.locator('text=File Explorer')).toBeVisible();
    await expect(page.locator('[data-testid="code-editor"]')).toBeVisible();
  });
});

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      window.localStorage.setItem('test-auth', 'true');
    });
    
    await page.goto('/');
  });

  test('should be able to search projects', async ({ page }) => {
    // Enter search query
    await page.fill('[placeholder="Search projects..."]', 'test');
    
    // Should filter projects
    await expect(page.locator('[data-testid="project-card"]')).toHaveCount(0);
  });

  test('should be able to filter projects by status', async ({ page }) => {
    // Open status filter
    await page.click('text=Filter by status');
    
    // Select deployed status
    await page.click('text=Deployed');
    
    // Should filter projects
    await expect(page.locator('[data-testid="project-card"]')).toHaveCount(0);
  });

  test('should be able to switch view modes', async ({ page }) => {
    // Click list view
    await page.click('[data-testid="list-view-button"]');
    
    // Should switch to list view
    await expect(page.locator('[data-testid="projects-list"]')).toBeVisible();
    
    // Click grid view
    await page.click('[data-testid="grid-view-button"]');
    
    // Should switch to grid view
    await expect(page.locator('[data-testid="projects-grid"]')).toBeVisible();
  });
});

test.describe('AI Assistant', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      window.localStorage.setItem('test-auth', 'true');
    });
    
    await page.goto('/ide/test-project');
  });

  test('should be able to open AI assistant', async ({ page }) => {
    // Click AI assistant button
    await page.click('[data-testid="ai-assistant-button"]');
    
    // Should open AI assistant
    await expect(page.locator('text=AI Assistant')).toBeVisible();
    await expect(page.locator('[placeholder="Ask AI to help you code..."]')).toBeVisible();
  });

  test('should be able to send AI request', async ({ page }) => {
    // Open AI assistant
    await page.click('[data-testid="ai-assistant-button"]');
    
    // Type message
    await page.fill('[placeholder="Ask AI to help you code..."]', 'Create a React component');
    
    // Send message
    await page.click('text=Send');
    
    // Should show loading state
    await expect(page.locator('text=AI is thinking...')).toBeVisible();
    
    // Should show response (mocked)
    await expect(page.locator('text=Here\'s a React component')).toBeVisible({ timeout: 10000 });
  });
});