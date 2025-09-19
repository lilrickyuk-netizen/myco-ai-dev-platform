import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export default async function globalSetup() {
  console.log('🚀 Starting global test setup...');

  // Ensure test directories exist
  const testDirs = [
    'test-results',
    'coverage',
    'coverage/backend',
    'coverage/frontend',
    'coverage/integration',
    'coverage/combined'
  ];

  for (const dir of testDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  }

  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.TEST_DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  process.env.AI_ENGINE_URL = 'http://localhost:8001';
  process.env.REDIS_URL = 'redis://localhost:6379/1';

  // Mock external services for testing
  process.env.OPENAI_API_KEY = 'sk-test-key-not-real';
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

  console.log('✅ Environment variables configured for testing');

  // Check if Docker is available for integration tests
  try {
    execSync('docker --version', { stdio: 'ignore' });
    process.env.DOCKER_AVAILABLE = 'true';
    console.log('🐳 Docker is available for integration tests');
  } catch (error) {
    process.env.DOCKER_AVAILABLE = 'false';
    console.log('⚠️  Docker not available - some integration tests may be skipped');
  }

  // Start test database if needed
  if (process.env.START_TEST_DB === 'true') {
    try {
      console.log('🗄️  Starting test database...');
      execSync('docker run -d --name test-postgres -e POSTGRES_DB=test_db -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:13', { stdio: 'ignore' });
      
      // Wait for database to be ready
      let dbReady = false;
      let attempts = 0;
      const maxAttempts = 30;
      
      while (!dbReady && attempts < maxAttempts) {
        try {
          execSync('pg_isready -h localhost -p 5432 -U test', { stdio: 'ignore' });
          dbReady = true;
          console.log('✅ Test database is ready');
        } catch {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!dbReady) {
        console.log('❌ Test database failed to start');
      }
    } catch (error) {
      console.log('⚠️  Could not start test database:', error);
    }
  }

  // Start test Redis if needed
  if (process.env.START_TEST_REDIS === 'true') {
    try {
      console.log('📦 Starting test Redis...');
      execSync('docker run -d --name test-redis -p 6379:6379 redis:7-alpine', { stdio: 'ignore' });
      console.log('✅ Test Redis started');
    } catch (error) {
      console.log('⚠️  Could not start test Redis:', error);
    }
  }

  // Create test data files
  const testDataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  // Create mock project data
  const mockProjects = [
    {
      id: 'test-project-001',
      name: 'Test Project 1',
      description: 'Mock project for testing',
      ownerId: 'test-user-001',
      techStack: ['React', 'TypeScript', 'Node.js'],
      status: 'active'
    },
    {
      id: 'test-project-002', 
      name: 'Test Project 2',
      description: 'Another mock project',
      ownerId: 'test-user-002',
      techStack: ['Vue', 'JavaScript', 'Express'],
      status: 'active'
    }
  ];

  fs.writeFileSync(
    path.join(testDataDir, 'mock-projects.json'),
    JSON.stringify(mockProjects, null, 2)
  );

  // Create mock user data
  const mockUsers = [
    {
      id: 'test-user-001',
      email: 'test1@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'user'
    },
    {
      id: 'test-user-002',
      email: 'test2@example.com', 
      firstName: 'Another',
      lastName: 'Tester',
      role: 'admin'
    }
  ];

  fs.writeFileSync(
    path.join(testDataDir, 'mock-users.json'),
    JSON.stringify(mockUsers, null, 2)
  );

  console.log('📄 Created mock test data files');

  // Set up coverage tracking
  if (process.env.TRACK_COVERAGE === 'true') {
    console.log('📊 Coverage tracking enabled');
  }

  // Setup complete
  console.log('✅ Global test setup completed successfully');
}