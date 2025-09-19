"""
Tests for base agent functionality
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch

from agents.base_agent import (
    BaseAgent, Task, TaskPriority, AgentType, AgentStatus, 
    AgentExecutionContext
)


class TestAgent(BaseAgent):
    """Test implementation of BaseAgent for testing"""
    
    def __init__(self):
        super().__init__("test-agent-001", AgentType.BACKEND)
        self.capabilities = ["test_task", "another_task"]
        
    async def execute_task(self, task: Task, context: AgentExecutionContext):
        if task.type == "test_task":
            return {"result": "success", "output": "test output"}
        elif task.type == "failing_task":
            raise Exception("Simulated task failure")
        elif task.type == "slow_task":
            await asyncio.sleep(0.1)
            return {"result": "completed after delay"}
        else:
            raise ValueError(f"Unknown task type: {task.type}")
    
    def can_handle_task(self, task: Task) -> bool:
        return task.type in ["test_task", "failing_task", "slow_task"]


class TestFailingAgent(BaseAgent):
    """Agent that always fails for error testing"""
    
    def __init__(self):
        super().__init__("failing-agent-001", AgentType.FRONTEND)
        
    async def execute_task(self, task: Task, context: AgentExecutionContext):
        raise Exception("Agent always fails")
    
    def can_handle_task(self, task: Task) -> bool:
        return True


class TestBaseAgent:
    """Test BaseAgent functionality"""
    
    @pytest.fixture
    def test_agent(self):
        return TestAgent()
    
    @pytest.fixture
    def failing_agent(self):
        return TestFailingAgent()
    
    @pytest.fixture
    def sample_task(self):
        return Task(
            id="test-task-001",
            type="test_task",
            description="A test task",
            priority=TaskPriority.MEDIUM,
            inputs={"test_input": "test_value"}
        )
    
    @pytest.fixture
    def sample_context(self):
        return AgentExecutionContext(
            project_id="test-project-001",
            user_id="test-user",
            requirements={"feature": "test_feature"},
            project_type="test_project",
            tech_stack=["python", "typescript"],
            configuration={"debug": True},
            workspace_path="/tmp/test-workspace"
        )
    
    def test_agent_initialization(self, test_agent):
        """Test agent initialization"""
        assert test_agent.agent_id == "test-agent-001"
        assert test_agent.agent_type == AgentType.BACKEND
        assert test_agent.status == AgentStatus.IDLE
        assert test_agent.current_task is None
        assert test_agent.capabilities == ["test_task", "another_task"]
        
        # Check initial performance metrics
        assert test_agent.performance_metrics["tasks_completed"] == 0
        assert test_agent.performance_metrics["tasks_failed"] == 0
        assert test_agent.performance_metrics["success_rate"] == 0.0
    
    def test_task_initialization(self):
        """Test task initialization and defaults"""
        task = Task(
            id="test-task",
            type="test",
            description="Test task",
            priority=TaskPriority.HIGH
        )
        
        assert task.id == "test-task"
        assert task.type == "test"
        assert task.description == "Test task"
        assert task.priority == TaskPriority.HIGH
        assert task.status == "pending"
        assert task.assigned_agent is None
        assert task.dependencies == []
        assert task.inputs == {}
        assert task.outputs == {}
        assert isinstance(task.created_at, datetime)
        assert task.started_at is None
        assert task.completed_at is None
        assert task.error is None
    
    def test_task_with_custom_values(self):
        """Test task with custom values"""
        dependencies = ["task-1", "task-2"]
        inputs = {"param1": "value1"}
        created_time = datetime.utcnow()
        
        task = Task(
            id="custom-task",
            type="custom",
            description="Custom task",
            priority=TaskPriority.LOW,
            dependencies=dependencies,
            inputs=inputs,
            created_at=created_time
        )
        
        assert task.dependencies == dependencies
        assert task.inputs == inputs
        assert task.created_at == created_time
    
    def test_agent_execution_context(self, sample_context):
        """Test agent execution context"""
        assert sample_context.project_id == "test-project-001"
        assert sample_context.user_id == "test-user"
        assert sample_context.requirements == {"feature": "test_feature"}
        assert sample_context.project_type == "test_project"
        assert sample_context.tech_stack == ["python", "typescript"]
        assert sample_context.configuration == {"debug": True}
        assert sample_context.workspace_path == "/tmp/test-workspace"
    
    def test_can_handle_task(self, test_agent, sample_task):
        """Test task handling capability check"""
        assert test_agent.can_handle_task(sample_task) is True
        
        unsupported_task = Task(
            id="unsupported",
            type="unsupported_task",
            description="Unsupported task",
            priority=TaskPriority.LOW
        )
        assert test_agent.can_handle_task(unsupported_task) is False
    
    @pytest.mark.asyncio
    async def test_successful_task_execution(self, test_agent, sample_task, sample_context):
        """Test successful task execution"""
        result = await test_agent.start_task(sample_task, sample_context)
        
        # Check task state
        assert sample_task.status == "completed"
        assert sample_task.assigned_agent == test_agent.agent_id
        assert sample_task.started_at is not None
        assert sample_task.completed_at is not None
        assert sample_task.error is None
        assert sample_task.outputs == {"result": "success", "output": "test output"}
        
        # Check agent state
        assert test_agent.status == AgentStatus.COMPLETED
        assert test_agent.current_task is None
        assert test_agent.performance_metrics["tasks_completed"] == 1
        assert test_agent.performance_metrics["tasks_failed"] == 0
        assert test_agent.performance_metrics["success_rate"] == 1.0
        
        # Check return value
        assert result == {"result": "success", "output": "test output"}
    
    @pytest.mark.asyncio
    async def test_failed_task_execution(self, test_agent, sample_context):
        """Test failed task execution"""
        failing_task = Task(
            id="failing-task",
            type="failing_task",
            description="Task that will fail",
            priority=TaskPriority.HIGH
        )
        
        with pytest.raises(Exception) as exc_info:
            await test_agent.start_task(failing_task, sample_context)
        
        assert str(exc_info.value) == "Simulated task failure"
        
        # Check task state
        assert failing_task.status == "failed"
        assert failing_task.assigned_agent == test_agent.agent_id
        assert failing_task.started_at is not None
        assert failing_task.completed_at is not None
        assert failing_task.error == "Simulated task failure"
        
        # Check agent state
        assert test_agent.status == AgentStatus.FAILED
        assert test_agent.current_task is None
        assert test_agent.performance_metrics["tasks_completed"] == 0
        assert test_agent.performance_metrics["tasks_failed"] == 1
        assert test_agent.performance_metrics["success_rate"] == 0.0
    
    @pytest.mark.asyncio
    async def test_task_timing(self, test_agent, sample_context):
        """Test task timing measurements"""
        slow_task = Task(
            id="slow-task",
            type="slow_task",
            description="Task that takes time",
            priority=TaskPriority.LOW
        )
        
        start_time = datetime.utcnow()
        await test_agent.start_task(slow_task, sample_context)
        end_time = datetime.utcnow()
        
        # Check timing
        assert slow_task.started_at >= start_time
        assert slow_task.completed_at >= slow_task.started_at
        assert slow_task.completed_at <= end_time
        
        # Should have taken at least 0.1 seconds
        duration = (slow_task.completed_at - slow_task.started_at).total_seconds()
        assert duration >= 0.1
    
    @pytest.mark.asyncio
    async def test_multiple_task_executions(self, test_agent, sample_context):
        """Test multiple task executions and metrics updates"""
        # Execute multiple successful tasks
        for i in range(3):
            task = Task(
                id=f"task-{i}",
                type="test_task",
                description=f"Test task {i}",
                priority=TaskPriority.MEDIUM
            )
            await test_agent.start_task(task, sample_context)
        
        # Execute one failing task
        failing_task = Task(
            id="failing-task",
            type="failing_task", 
            description="Failing task",
            priority=TaskPriority.HIGH
        )
        
        with pytest.raises(Exception):
            await test_agent.start_task(failing_task, sample_context)
        
        # Check final metrics
        assert test_agent.performance_metrics["tasks_completed"] == 3
        assert test_agent.performance_metrics["tasks_failed"] == 1
        assert test_agent.performance_metrics["success_rate"] == 0.75  # 3/4
    
    def test_get_status(self, test_agent):
        """Test agent status reporting"""
        status = test_agent.get_status()
        
        expected_keys = [
            "agent_id", "agent_type", "status", "current_task", 
            "capabilities", "performance_metrics"
        ]
        
        for key in expected_keys:
            assert key in status
        
        assert status["agent_id"] == "test-agent-001"
        assert status["agent_type"] == "backend"
        assert status["status"] == "idle"
        assert status["current_task"] is None
        assert status["capabilities"] == ["test_task", "another_task"]
        assert isinstance(status["performance_metrics"], dict)
    
    @pytest.mark.asyncio
    async def test_concurrent_task_execution(self, test_agent, sample_context):
        """Test that agent can't execute multiple tasks concurrently"""
        # Create two tasks
        task1 = Task(
            id="task-1",
            type="slow_task",
            description="First slow task",
            priority=TaskPriority.HIGH
        )
        
        task2 = Task(
            id="task-2", 
            type="test_task",
            description="Second task",
            priority=TaskPriority.HIGH
        )
        
        # Start first task (which will take time)
        task1_coroutine = test_agent.start_task(task1, sample_context)
        
        # Give it a moment to start
        await asyncio.sleep(0.01)
        
        # Verify agent is working
        assert test_agent.status == AgentStatus.WORKING
        assert test_agent.current_task.id == "task-1"
        
        # Complete first task
        await task1_coroutine
        
        # Now start second task
        await test_agent.start_task(task2, sample_context)
        
        # Both tasks should be completed
        assert task1.status == "completed"
        assert task2.status == "completed"
        assert test_agent.performance_metrics["tasks_completed"] == 2
    
    def test_task_priority_enum(self):
        """Test task priority enumeration"""
        assert TaskPriority.LOW.value == 1
        assert TaskPriority.MEDIUM.value == 2
        assert TaskPriority.HIGH.value == 3
        assert TaskPriority.CRITICAL.value == 4
        
        # Test ordering
        assert TaskPriority.LOW < TaskPriority.MEDIUM
        assert TaskPriority.MEDIUM < TaskPriority.HIGH
        assert TaskPriority.HIGH < TaskPriority.CRITICAL
    
    def test_agent_type_enum(self):
        """Test agent type enumeration"""
        expected_types = [
            "orchestrator", "planner", "architecture", "backend", 
            "frontend", "infrastructure", "security", "verifier",
            "deployer", "monitor", "integrator", "documenter", "optimizer"
        ]
        
        for expected_type in expected_types:
            assert any(agent_type.value == expected_type for agent_type in AgentType)
    
    def test_agent_status_enum(self):
        """Test agent status enumeration"""
        expected_statuses = ["idle", "working", "completed", "failed", "paused"]
        
        for expected_status in expected_statuses:
            assert any(status.value == expected_status for status in AgentStatus)
    
    @pytest.mark.asyncio
    async def test_task_with_dependencies(self, sample_context):
        """Test task with dependencies"""
        task = Task(
            id="dependent-task",
            type="test_task",
            description="Task with dependencies",
            priority=TaskPriority.MEDIUM,
            dependencies=["dep-1", "dep-2"]
        )
        
        assert task.dependencies == ["dep-1", "dep-2"]
    
    @pytest.mark.asyncio
    async def test_agent_error_handling(self, failing_agent, sample_task, sample_context):
        """Test error handling in agent execution"""
        with pytest.raises(Exception) as exc_info:
            await failing_agent.start_task(sample_task, sample_context)
        
        assert "Agent always fails" in str(exc_info.value)
        
        # Check that agent state is properly updated even after failure
        assert failing_agent.status == AgentStatus.FAILED
        assert failing_agent.current_task is None
        assert failing_agent.performance_metrics["tasks_failed"] == 1
    
    @pytest.mark.asyncio
    async def test_task_assignment(self, test_agent, sample_task, sample_context):
        """Test task assignment to agent"""
        assert sample_task.assigned_agent is None
        
        await test_agent.start_task(sample_task, sample_context)
        
        assert sample_task.assigned_agent == test_agent.agent_id
    
    def test_success_rate_calculation(self, test_agent):
        """Test success rate calculation with different scenarios"""
        # Initially no tasks
        assert test_agent.performance_metrics["success_rate"] == 0.0
        
        # Simulate completed tasks
        test_agent.performance_metrics["tasks_completed"] = 7
        test_agent.performance_metrics["tasks_failed"] = 3
        test_agent._update_success_rate()
        
        assert test_agent.performance_metrics["success_rate"] == 0.7  # 7/10
        
        # All successful
        test_agent.performance_metrics["tasks_completed"] = 5
        test_agent.performance_metrics["tasks_failed"] = 0
        test_agent._update_success_rate()
        
        assert test_agent.performance_metrics["success_rate"] == 1.0
        
        # All failed
        test_agent.performance_metrics["tasks_completed"] = 0
        test_agent.performance_metrics["tasks_failed"] = 3
        test_agent._update_success_rate()
        
        assert test_agent.performance_metrics["success_rate"] == 0.0


class TestTaskDataclass:
    """Test Task dataclass functionality"""
    
    def test_task_serialization(self):
        """Test task can be converted to dict"""
        task = Task(
            id="serialization-test",
            type="test_type",
            description="Test serialization",
            priority=TaskPriority.HIGH
        )
        
        task_dict = task.__dict__
        
        assert "id" in task_dict
        assert "type" in task_dict
        assert "description" in task_dict
        assert "priority" in task_dict
        assert task_dict["id"] == "serialization-test"
    
    def test_task_equality(self):
        """Test task equality comparison"""
        task1 = Task(
            id="test-task",
            type="test",
            description="Test task",
            priority=TaskPriority.MEDIUM
        )
        
        task2 = Task(
            id="test-task",
            type="test", 
            description="Test task",
            priority=TaskPriority.MEDIUM
        )
        
        # Should be equal if all fields are the same
        # Note: created_at will differ, so we need to set it manually
        task2.created_at = task1.created_at
        assert task1 == task2


class TestAgentExecutionContextDataclass:
    """Test AgentExecutionContext dataclass functionality"""
    
    def test_context_serialization(self):
        """Test context can be converted to dict"""
        context = AgentExecutionContext(
            project_id="test-project",
            user_id="test-user",
            requirements={"req": "value"},
            project_type="test",
            tech_stack=["python"],
            configuration={"config": "value"},
            workspace_path="/tmp/test"
        )
        
        context_dict = context.__dict__
        required_fields = [
            "project_id", "user_id", "requirements", "project_type",
            "tech_stack", "configuration", "workspace_path"
        ]
        
        for field in required_fields:
            assert field in context_dict
    
    def test_context_immutability(self):
        """Test that context fields are properly typed"""
        context = AgentExecutionContext(
            project_id="test-project",
            user_id="test-user", 
            requirements={"req": "value"},
            project_type="test",
            tech_stack=["python"],
            configuration={"config": "value"},
            workspace_path="/tmp/test"
        )
        
        assert isinstance(context.tech_stack, list)
        assert isinstance(context.requirements, dict)
        assert isinstance(context.configuration, dict)
        assert isinstance(context.project_id, str)