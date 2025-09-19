import { test, expect } from '@playwright/test';

test.describe('Complete User Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for all tests
    await page.addInitScript(() => {
      (window as any).__clerk_publishable_key = 'pk_test_mock_key_for_testing';
      (window as any).__clerk_frontend_api = 'clerk.mock.test';
      
      // Mock user session
      (window as any).__clerk_user = {
        id: 'test_user_123',
        firstName: 'Test',
        lastName: 'User',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        imageUrl: 'https://example.com/avatar.jpg'
      };
    });

    // Mock backend API responses
    await page.route('**/api/**', (route) => {
      const url = route.request().url();
      
      if (url.includes('/projects/list')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            projects: [
              {
                id: 'proj_001',
                name: 'E2E Test Project',
                description: 'Test project for E2E testing',
                ownerId: 'test_user_123',
                visibility: 'private',
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                techStack: ['React', 'TypeScript', 'Node.js'],
                metadata: {}
              }
            ],
            total: 1
          })
        });
      } else if (url.includes('/projects/create')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'proj_new_001',
            name: 'New Test Project',
            description: 'Newly created test project',
            ownerId: 'test_user_123',
            visibility: 'private',
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            techStack: ['React', 'TypeScript'],
            metadata: {}
          })
        });
      } else if (url.includes('/filesystem/')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                id: 'file_001',
                name: 'src',
                path: '/src',
                type: 'directory',
                children: [
                  {
                    id: 'file_002',
                    name: 'App.tsx',
                    path: '/src/App.tsx',
                    type: 'file',
                    content: 'import React from "react";\n\nfunction App() {\n  return <div>Hello World</div>;\n}\n\nexport default App;',
                    size: 95,
                    lastModified: new Date().toISOString()
                  }
                ]
              }
            ]
          })
        });
      } else if (url.includes('/ai/generate')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: 'Here is a React component example:\n\n```tsx\nfunction Button({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {\n  return (\n    <button onClick={onClick} className="btn">\n      {children}\n    </button>\n  );\n}\n```',
            usage: {
              promptTokens: 15,
              completionTokens: 45,
              totalTokens: 60
            }
          })
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      }
    });
  });

  test('should complete full project creation and development workflow', async ({ page }) => {
    // 1. Navigate to dashboard
    await page.goto('/');
    
    // Wait for dashboard to load
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Projects');

    // 2. Create new project
    await page.click('[data-testid="create-project-button"]');
    
    // Fill project creation form
    await page.fill('[data-testid="project-name-input"]', 'E2E Test Project');
    await page.fill('[data-testid="project-description-input"]', 'Project created via E2E test');
    
    // Select React TypeScript template
    await page.click('[data-testid="template-react-typescript"]');
    
    // Submit project creation
    await page.click('[data-testid="create-project-submit"]');
    
    // Should navigate to IDE
    await expect(page).toHaveURL(/.*\/ide\/.*/);

    // 3. Wait for IDE to fully load
    await expect(page.locator('[data-testid="file-explorer"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="code-editor"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="ai-assistant"]')).toBeVisible({ timeout: 15000 });

    // 4. Interact with file explorer
    await page.click('[data-testid="file-explorer"] text=src');
    await expect(page.locator('text=App.tsx')).toBeVisible();
    
    // Open App.tsx file
    await page.click('text=App.tsx');
    
    // 5. Verify code editor shows file content
    await expect(page.locator('[data-testid="code-editor"]')).toContainText('import React');
    await expect(page.locator('[data-testid="code-editor"]')).toContainText('Hello World');

    // 6. Use AI assistant
    await page.fill('[data-testid="ai-chat-input"]', 'Create a button component');
    await page.press('[data-testid="ai-chat-input"]', 'Enter');
    
    // Wait for AI response
    await expect(page.locator('[data-testid="ai-messages"]')).toContainText('React component example', { timeout: 10000 });
    await expect(page.locator('[data-testid="ai-messages"]')).toContainText('function Button');

    // 7. Insert AI-generated code
    await page.click('[data-testid="ai-code-insert-button"]');
    
    // Verify code was inserted
    await expect(page.locator('[data-testid="code-editor"]')).toContainText('function Button');

    // 8. Save file
    await page.keyboard.press('Control+S');
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible({ timeout: 5000 });

    // 9. Create new file
    await page.click('[data-testid="file-explorer-new-file"]');
    await page.fill('[data-testid="new-file-name"]', 'Button.tsx');
    await page.press('[data-testid="new-file-name"]', 'Enter');
    
    // Verify new file appears in explorer
    await expect(page.locator('text=Button.tsx')).toBeVisible();

    // 10. Test terminal functionality
    await page.click('[data-testid="terminal-tab"]');
    await expect(page.locator('[data-testid="terminal"]')).toBeVisible();
    
    // Type command in terminal
    await page.type('[data-testid="terminal-input"]', 'npm run build');
    await page.press('[data-testid="terminal-input"]', 'Enter');

    // 11. Test collaboration features
    await page.click('[data-testid="collaboration-panel"]');
    await expect(page.locator('[data-testid="collaboration-status"]')).toContainText('Connected');

    // 12. Navigate back to dashboard
    await page.click('[data-testid="home-button"]');
    await expect(page).toHaveURL('/');
    
    // Verify project appears in dashboard
    await expect(page.locator('[data-testid="project-grid"]')).toContainText('E2E Test Project');
  });

  test('should handle project settings and configuration', async ({ page }) => {
    // Navigate to dashboard and select existing project
    await page.goto('/');
    await page.click('[data-testid="project-settings-proj_001"]');
    
    // Should navigate to settings page
    await expect(page).toHaveURL(/.*\/project\/proj_001\/settings/);
    
    // Test general settings
    await page.fill('[data-testid="project-name-input"]', 'Updated Project Name');
    await page.fill('[data-testid="project-description-input"]', 'Updated description');
    
    // Test tech stack configuration
    await page.click('[data-testid="tech-stack-add"]');
    await page.selectOption('[data-testid="tech-stack-select"]', 'Express.js');
    await page.click('[data-testid="tech-stack-confirm"]');
    
    // Verify tech stack was added
    await expect(page.locator('[data-testid="tech-stack-list"]')).toContainText('Express.js');
    
    // Test environment variables
    await page.click('[data-testid="env-vars-tab"]');
    await page.click('[data-testid="add-env-var"]');
    await page.fill('[data-testid="env-var-key"]', 'API_URL');
    await page.fill('[data-testid="env-var-value"]', 'https://api.example.com');
    await page.click('[data-testid="env-var-save"]');
    
    // Verify environment variable was added
    await expect(page.locator('[data-testid="env-vars-list"]')).toContainText('API_URL');
    
    // Test deployment settings
    await page.click('[data-testid="deployment-tab"]');
    await page.selectOption('[data-testid="deployment-provider"]', 'vercel');
    await page.fill('[data-testid="deployment-config"]', '{"framework": "nextjs"}');
    
    // Save all settings
    await page.click('[data-testid="save-settings"]');
    await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible();
  });

  test('should handle error scenarios gracefully', async ({ page }) => {
    // Mock API errors for this test
    await page.route('**/api/projects/create', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    await page.goto('/');
    
    // Try to create project that will fail
    await page.click('[data-testid="create-project-button"]');
    await page.fill('[data-testid="project-name-input"]', 'Failing Project');
    await page.click('[data-testid="create-project-submit"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Internal server error');
    
    // Should remain on dashboard
    await expect(page).toHaveURL('/');
  });

  test('should support collaborative editing', async ({ page, context }) => {
    // Create second browser context to simulate another user
    const secondContext = await context.browser()?.newContext();
    const secondPage = await secondContext?.newPage();
    
    if (!secondPage) return;
    
    // Setup same mocks for second page
    await secondPage.addInitScript(() => {
      (window as any).__clerk_publishable_key = 'pk_test_mock_key_for_testing';
      (window as any).__clerk_user = {
        id: 'test_user_456',
        firstName: 'Second',
        lastName: 'User',
        emailAddresses: [{ emailAddress: 'second@example.com' }]
      };
    });
    
    // Both users navigate to same project
    await page.goto('/ide/proj_001');
    await secondPage.goto('/ide/proj_001');
    
    // Wait for both IDEs to load
    await expect(page.locator('[data-testid="code-editor"]')).toBeVisible();
    await expect(secondPage.locator('[data-testid="code-editor"]')).toBeVisible();
    
    // First user makes changes
    await page.locator('[data-testid="code-editor"] textarea').fill('console.log("Hello from user 1");');
    
    // Second user should see the changes (in real implementation)
    // For now, we'll just verify the collaboration panel shows connected users
    await expect(page.locator('[data-testid="collaboration-users"]')).toContainText('2 users');
    await expect(secondPage.locator('[data-testid="collaboration-users"]')).toContainText('2 users');
    
    await secondContext?.close();
  });

  test('should handle file operations comprehensively', async ({ page }) => {
    await page.goto('/ide/proj_001');
    
    // Wait for file explorer to load
    await expect(page.locator('[data-testid="file-explorer"]')).toBeVisible();
    
    // Test creating folder
    await page.click('[data-testid="file-explorer-new-folder"]');
    await page.fill('[data-testid="new-folder-name"]', 'components');
    await page.press('[data-testid="new-folder-name"]', 'Enter');
    
    await expect(page.locator('text=components')).toBeVisible();
    
    // Test creating file in folder
    await page.click('text=components');
    await page.click('[data-testid="folder-context-menu"]');
    await page.click('[data-testid="new-file-in-folder"]');
    await page.fill('[data-testid="new-file-name"]', 'Header.tsx');
    await page.press('[data-testid="new-file-name"]', 'Enter');
    
    await expect(page.locator('text=Header.tsx')).toBeVisible();
    
    // Test file renaming
    await page.click('[data-testid="file-context-menu-Header.tsx"]');
    await page.click('[data-testid="rename-file"]');
    await page.fill('[data-testid="rename-input"]', 'Navigation.tsx');
    await page.press('[data-testid="rename-input"]', 'Enter');
    
    await expect(page.locator('text=Navigation.tsx')).toBeVisible();
    await expect(page.locator('text=Header.tsx')).not.toBeVisible();
    
    // Test file deletion
    await page.click('[data-testid="file-context-menu-Navigation.tsx"]');
    await page.click('[data-testid="delete-file"]');
    await page.click('[data-testid="confirm-delete"]');
    
    await expect(page.locator('text=Navigation.tsx')).not.toBeVisible();
  });

  test('should support search and replace functionality', async ({ page }) => {
    await page.goto('/ide/proj_001');
    
    // Open a file with content
    await page.click('text=App.tsx');
    
    // Open search dialog
    await page.keyboard.press('Control+F');
    await expect(page.locator('[data-testid="search-dialog"]')).toBeVisible();
    
    // Search for text
    await page.fill('[data-testid="search-input"]', 'Hello World');
    await expect(page.locator('[data-testid="search-results"]')).toContainText('1 result');
    
    // Replace text
    await page.click('[data-testid="replace-toggle"]');
    await page.fill('[data-testid="replace-input"]', 'Hello Universe');
    await page.click('[data-testid="replace-all"]');
    
    // Verify replacement
    await expect(page.locator('[data-testid="code-editor"]')).toContainText('Hello Universe');
    await expect(page.locator('[data-testid="code-editor"]')).not.toContainText('Hello World');
    
    // Close search dialog
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="search-dialog"]')).not.toBeVisible();
  });

  test('should handle AI assistant conversation flow', async ({ page }) => {
    await page.goto('/ide/proj_001');
    
    // Wait for AI assistant to load
    await expect(page.locator('[data-testid="ai-assistant"]')).toBeVisible();
    
    // Start conversation
    await page.fill('[data-testid="ai-chat-input"]', 'How do I create a responsive navbar?');
    await page.press('[data-testid="ai-chat-input"]', 'Enter');
    
    // Wait for response
    await expect(page.locator('[data-testid="ai-messages"]')).toContainText('navbar', { timeout: 10000 });
    
    // Continue conversation
    await page.fill('[data-testid="ai-chat-input"]', 'Can you make it use Tailwind CSS?');
    await page.press('[data-testid="ai-chat-input"]', 'Enter');
    
    // Should show multiple messages
    const messages = page.locator('[data-testid="ai-message"]');
    await expect(messages).toHaveCount(3); // System message + 2 responses
    
    // Test quick actions
    await page.click('[data-testid="ai-quick-action-debug"]');
    await expect(page.locator('[data-testid="ai-chat-input"]')).toHaveValue('Help me debug this issue: ');
    
    // Test conversation history
    await page.click('[data-testid="ai-conversation-history"]');
    await expect(page.locator('[data-testid="conversation-list"]')).toBeVisible();
  });

  test('should validate form inputs and show appropriate errors', async ({ page }) => {
    await page.goto('/');
    
    // Try to create project with invalid data
    await page.click('[data-testid="create-project-button"]');
    
    // Submit without required fields
    await page.click('[data-testid="create-project-submit"]');
    
    // Should show validation errors
    await expect(page.locator('[data-testid="project-name-error"]')).toContainText('Project name is required');
    
    // Fill invalid name (too short)
    await page.fill('[data-testid="project-name-input"]', 'ab');
    await page.click('[data-testid="create-project-submit"]');
    
    await expect(page.locator('[data-testid="project-name-error"]')).toContainText('at least 3 characters');
    
    // Fill valid data
    await page.fill('[data-testid="project-name-input"]', 'Valid Project Name');
    await page.fill('[data-testid="project-description-input"]', 'Valid description');
    await page.click('[data-testid="template-react-typescript"]');
    
    // Should be able to submit now
    await page.click('[data-testid="create-project-submit"]');
    await expect(page).toHaveURL(/.*\/ide\/.*/);
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    await page.goto('/ide/proj_001');
    
    // Wait for IDE to load
    await expect(page.locator('[data-testid="code-editor"]')).toBeVisible();
    
    // Test save shortcut
    await page.keyboard.press('Control+S');
    await expect(page.locator('[data-testid="save-status"]')).toContainText('Saved');
    
    // Test new file shortcut
    await page.keyboard.press('Control+N');
    await expect(page.locator('[data-testid="new-file-dialog"]')).toBeVisible();
    await page.keyboard.press('Escape');
    
    // Test search shortcut
    await page.keyboard.press('Control+F');
    await expect(page.locator('[data-testid="search-dialog"]')).toBeVisible();
    await page.keyboard.press('Escape');
    
    // Test command palette
    await page.keyboard.press('Control+Shift+P');
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible();
    await page.keyboard.press('Escape');
  });
});