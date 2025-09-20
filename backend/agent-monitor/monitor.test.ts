import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const db = new SQLDatabase("agent_monitor", { migrations: "./db/migrations" });

describe("Agent Monitor Service", () => {
  let testWorkflowId: string;
  let testAgentId: string;

  beforeAll(async () => {
    // Create test workflow
    const workflow = await db.queryRow`
      INSERT INTO workflows (project_id, current_phase)
      VALUES ('test-project-123', 'Testing')
      RETURNING id
    `;
    testWorkflowId = workflow?.id;

    // Create test agent
    const agent = await db.queryRow`
      INSERT INTO agents (workflow_id, name, type)
      VALUES (${testWorkflowId}, 'Test Agent', 'backend')
      RETURNING id
    `;
    testAgentId = agent?.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.exec`DELETE FROM workflows WHERE id = ${testWorkflowId}`;
  });

  it("should create workflow with agents", async () => {
    const workflow = await db.queryRow`
      SELECT * FROM workflows WHERE id = ${testWorkflowId}
    `;
    
    expect(workflow).toBeTruthy();
    expect(workflow?.project_id).toBe('test-project-123');
    expect(workflow?.status).toBe('pending');
  });

  it("should track agent progress", async () => {
    // Update agent progress
    await db.exec`
      UPDATE agents 
      SET progress = 50, status = 'running'
      WHERE id = ${testAgentId}
    `;

    const agent = await db.queryRow`
      SELECT * FROM agents WHERE id = ${testAgentId}
    `;

    expect(agent?.progress).toBe(50);
    expect(agent?.status).toBe('running');
  });

  it("should record progress updates", async () => {
    // Insert progress update
    await db.exec`
      INSERT INTO agent_progress_updates (
        workflow_id, agent_id, progress, status, message
      )
      VALUES (${testWorkflowId}, ${testAgentId}, 75, 'running', 'Test progress update')
    `;

    const updates = await db.queryAll`
      SELECT * FROM agent_progress_updates 
      WHERE workflow_id = ${testWorkflowId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    expect(updates.length).toBe(1);
    expect(updates[0].progress).toBe(75);
    expect(updates[0].message).toBe('Test progress update');
  });

  it("should calculate workflow progress", async () => {
    // Create additional agents
    await db.exec`
      INSERT INTO agents (workflow_id, name, type, status, progress)
      VALUES 
        (${testWorkflowId}, 'Agent 2', 'frontend', 'completed', 100),
        (${testWorkflowId}, 'Agent 3', 'validation', 'running', 25)
    `;

    // Calculate total progress (should be average of all agents)
    const agents = await db.queryRow`
      SELECT AVG(progress) as avg_progress
      FROM agents 
      WHERE workflow_id = ${testWorkflowId}
    `;

    const avgProgress = Math.round(agents?.avg_progress || 0);
    expect(avgProgress).toBeGreaterThan(0);
    expect(avgProgress).toBeLessThanOrEqual(100);
  });
});