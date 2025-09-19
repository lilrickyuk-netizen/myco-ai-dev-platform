import pytest
from unittest.mock import Mock, patch, AsyncMock
from services.agent_manager import AgentManager, AgentType
from core.exceptions import AgentError

class TestAgentManager:
    
    @pytest.fixture
    def agent_manager(self):
        return AgentManager()
    
    @pytest.fixture
    def mock_llm_manager(self):
        mock = Mock()
        mock.generate_completion = AsyncMock(return_value="LLM response")
        return mock
    
    def test_init(self, agent_manager):
        """Test AgentManager initialization"""
        assert agent_manager.agents == {}
        assert agent_manager.active_sessions == {}
    
    def test_register_agent(self, agent_manager):
        """Test registering an agent"""
        agent_config = {
            "name": "test_agent",
            "type": AgentType.CODE_GENERATION,
            "model": "gpt-3.5-turbo",
            "system_prompt": "You are a code generation assistant"
        }
        
        agent_id = agent_manager.register_agent(agent_config)
        
        assert agent_id in agent_manager.agents
        assert agent_manager.agents[agent_id]["name"] == "test_agent"
        assert agent_manager.agents[agent_id]["type"] == AgentType.CODE_GENERATION
    
    def test_register_duplicate_agent(self, agent_manager):
        """Test registering duplicate agent"""
        agent_config = {
            "name": "duplicate_agent",
            "type": AgentType.CODE_GENERATION,
            "model": "gpt-3.5-turbo",
            "system_prompt": "Test prompt"
        }
        
        agent_id1 = agent_manager.register_agent(agent_config)
        agent_id2 = agent_manager.register_agent(agent_config)
        
        # Should create different agent IDs
        assert agent_id1 != agent_id2
        assert len(agent_manager.agents) == 2
    
    def test_get_agent(self, agent_manager):
        """Test getting agent by ID"""
        agent_config = {
            "name": "test_agent",
            "type": AgentType.CHAT,
            "model": "gpt-3.5-turbo",
            "system_prompt": "Test prompt"
        }
        
        agent_id = agent_manager.register_agent(agent_config)
        retrieved_agent = agent_manager.get_agent(agent_id)
        
        assert retrieved_agent["name"] == "test_agent"
        assert retrieved_agent["type"] == AgentType.CHAT
    
    def test_get_nonexistent_agent(self, agent_manager):
        """Test getting non-existent agent"""
        with pytest.raises(AgentError, match="Agent not found"):
            agent_manager.get_agent("nonexistent_id")
    
    def test_list_agents(self, agent_manager):
        """Test listing all agents"""
        # Register multiple agents
        for i in range(3):
            agent_config = {
                "name": f"agent_{i}",
                "type": AgentType.CODE_GENERATION,
                "model": "gpt-3.5-turbo",
                "system_prompt": f"Agent {i} prompt"
            }
            agent_manager.register_agent(agent_config)
        
        agents = agent_manager.list_agents()
        assert len(agents) == 3
        assert all("id" in agent for agent in agents)
        assert all("name" in agent for agent in agents)
    
    def test_list_agents_by_type(self, agent_manager):
        """Test listing agents by type"""
        # Register agents of different types
        code_agent_config = {
            "name": "code_agent",
            "type": AgentType.CODE_GENERATION,
            "model": "gpt-3.5-turbo",
            "system_prompt": "Code generation prompt"
        }
        
        chat_agent_config = {
            "name": "chat_agent",
            "type": AgentType.CHAT,
            "model": "gpt-3.5-turbo",
            "system_prompt": "Chat prompt"
        }
        
        agent_manager.register_agent(code_agent_config)
        agent_manager.register_agent(chat_agent_config)
        
        code_agents = agent_manager.list_agents(agent_type=AgentType.CODE_GENERATION)
        chat_agents = agent_manager.list_agents(agent_type=AgentType.CHAT)
        
        assert len(code_agents) == 1
        assert len(chat_agents) == 1
        assert code_agents[0]["type"] == AgentType.CODE_GENERATION
        assert chat_agents[0]["type"] == AgentType.CHAT
    
    @pytest.mark.asyncio
    async def test_create_session(self, agent_manager, mock_llm_manager):
        """Test creating an agent session"""
        agent_config = {
            "name": "session_agent",
            "type": AgentType.CHAT,
            "model": "gpt-3.5-turbo",
            "system_prompt": "Session test prompt"
        }
        
        agent_id = agent_manager.register_agent(agent_config)
        
        with patch.object(agent_manager, 'llm_manager', mock_llm_manager):
            session_id = await agent_manager.create_session(agent_id, user_id="user123")
        
        assert session_id in agent_manager.active_sessions
        session = agent_manager.active_sessions[session_id]
        assert session["agent_id"] == agent_id
        assert session["user_id"] == "user123"
        assert session["messages"] == []
    
    @pytest.mark.asyncio
    async def test_create_session_invalid_agent(self, agent_manager):
        """Test creating session with invalid agent"""
        with pytest.raises(AgentError, match="Agent not found"):
            await agent_manager.create_session("invalid_agent_id", user_id="user123")
    
    @pytest.mark.asyncio
    async def test_send_message(self, agent_manager, mock_llm_manager):
        """Test sending message to agent session"""
        agent_config = {
            "name": "message_agent",
            "type": AgentType.CHAT,
            "model": "gpt-3.5-turbo",
            "system_prompt": "Message test prompt"
        }
        
        agent_id = agent_manager.register_agent(agent_config)
        
        with patch.object(agent_manager, 'llm_manager', mock_llm_manager):
            session_id = await agent_manager.create_session(agent_id, user_id="user123")
            
            response = await agent_manager.send_message(
                session_id=session_id,
                message="Hello, agent!"
            )
        
        assert response == "LLM response"
        
        # Check message history
        session = agent_manager.active_sessions[session_id]
        assert len(session["messages"]) == 2  # user message + agent response
        assert session["messages"][0]["role"] == "user"
        assert session["messages"][0]["content"] == "Hello, agent!"
        assert session["messages"][1]["role"] == "assistant"
        assert session["messages"][1]["content"] == "LLM response"
    
    @pytest.mark.asyncio
    async def test_send_message_invalid_session(self, agent_manager):
        """Test sending message to invalid session"""
        with pytest.raises(AgentError, match="Session not found"):
            await agent_manager.send_message(
                session_id="invalid_session",
                message="Hello"
            )
    
    @pytest.mark.asyncio
    async def test_stream_message(self, agent_manager, mock_llm_manager):
        """Test streaming message response"""
        agent_config = {
            "name": "stream_agent",
            "type": AgentType.CHAT,
            "model": "gpt-3.5-turbo",
            "system_prompt": "Stream test prompt"
        }
        
        agent_id = agent_manager.register_agent(agent_config)
        
        async def mock_stream():
            yield "chunk1"
            yield "chunk2"
            yield "chunk3"
        
        mock_llm_manager.stream_completion = AsyncMock(return_value=mock_stream())
        
        with patch.object(agent_manager, 'llm_manager', mock_llm_manager):
            session_id = await agent_manager.create_session(agent_id, user_id="user123")
            
            chunks = []
            async for chunk in agent_manager.stream_message(
                session_id=session_id,
                message="Stream this message"
            ):
                chunks.append(chunk)
        
        assert chunks == ["chunk1", "chunk2", "chunk3"]
    
    def test_get_session_history(self, agent_manager):
        """Test getting session message history"""
        # Create a session with some message history
        session_id = "test_session"
        agent_manager.active_sessions[session_id] = {
            "agent_id": "test_agent",
            "user_id": "user123",
            "messages": [
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi there!"},
                {"role": "user", "content": "How are you?"},
                {"role": "assistant", "content": "I'm doing well!"}
            ],
            "created_at": "2024-01-01T00:00:00Z"
        }
        
        history = agent_manager.get_session_history(session_id)
        
        assert len(history) == 4
        assert history[0]["role"] == "user"
        assert history[0]["content"] == "Hello"
        assert history[-1]["role"] == "assistant"
        assert history[-1]["content"] == "I'm doing well!"
    
    def test_get_session_history_invalid_session(self, agent_manager):
        """Test getting history for invalid session"""
        with pytest.raises(AgentError, match="Session not found"):
            agent_manager.get_session_history("invalid_session")
    
    def test_close_session(self, agent_manager):
        """Test closing an agent session"""
        session_id = "test_session"
        agent_manager.active_sessions[session_id] = {
            "agent_id": "test_agent",
            "user_id": "user123",
            "messages": [],
            "created_at": "2024-01-01T00:00:00Z"
        }
        
        agent_manager.close_session(session_id)
        
        assert session_id not in agent_manager.active_sessions
    
    def test_close_invalid_session(self, agent_manager):
        """Test closing invalid session"""
        with pytest.raises(AgentError, match="Session not found"):
            agent_manager.close_session("invalid_session")
    
    def test_update_agent(self, agent_manager):
        """Test updating agent configuration"""
        agent_config = {
            "name": "updateable_agent",
            "type": AgentType.CODE_GENERATION,
            "model": "gpt-3.5-turbo",
            "system_prompt": "Original prompt"
        }
        
        agent_id = agent_manager.register_agent(agent_config)
        
        updates = {
            "name": "updated_agent",
            "system_prompt": "Updated prompt"
        }
        
        updated_agent = agent_manager.update_agent(agent_id, updates)
        
        assert updated_agent["name"] == "updated_agent"
        assert updated_agent["system_prompt"] == "Updated prompt"
        assert updated_agent["model"] == "gpt-3.5-turbo"  # Unchanged
    
    def test_update_invalid_agent(self, agent_manager):
        """Test updating invalid agent"""
        with pytest.raises(AgentError, match="Agent not found"):
            agent_manager.update_agent("invalid_agent", {"name": "new_name"})
    
    def test_delete_agent(self, agent_manager):
        """Test deleting an agent"""
        agent_config = {
            "name": "deletable_agent",
            "type": AgentType.CHAT,
            "model": "gpt-3.5-turbo",
            "system_prompt": "Delete me"
        }
        
        agent_id = agent_manager.register_agent(agent_config)
        assert agent_id in agent_manager.agents
        
        agent_manager.delete_agent(agent_id)
        assert agent_id not in agent_manager.agents
    
    def test_delete_agent_with_active_sessions(self, agent_manager):
        """Test deleting agent with active sessions"""
        agent_config = {
            "name": "agent_with_sessions",
            "type": AgentType.CHAT,
            "model": "gpt-3.5-turbo",
            "system_prompt": "Agent with sessions"
        }
        
        agent_id = agent_manager.register_agent(agent_config)
        
        # Create some active sessions
        session_ids = ["session1", "session2", "session3"]
        for session_id in session_ids:
            agent_manager.active_sessions[session_id] = {
                "agent_id": agent_id,
                "user_id": "user123",
                "messages": [],
                "created_at": "2024-01-01T00:00:00Z"
            }
        
        agent_manager.delete_agent(agent_id)
        
        # Agent should be deleted
        assert agent_id not in agent_manager.agents
        
        # Associated sessions should be closed
        for session_id in session_ids:
            assert session_id not in agent_manager.active_sessions
    
    def test_get_agent_stats(self, agent_manager):
        """Test getting agent statistics"""
        agent_config = {
            "name": "stats_agent",
            "type": AgentType.CHAT,
            "model": "gpt-3.5-turbo",
            "system_prompt": "Stats agent"
        }
        
        agent_id = agent_manager.register_agent(agent_config)
        
        # Create some sessions for the agent
        for i in range(3):
            session_id = f"session_{i}"
            agent_manager.active_sessions[session_id] = {
                "agent_id": agent_id,
                "user_id": f"user_{i}",
                "messages": [{"role": "user", "content": f"Message {i}"}],
                "created_at": "2024-01-01T00:00:00Z"
            }
        
        stats = agent_manager.get_agent_stats(agent_id)
        
        assert stats["active_sessions"] == 3
        assert stats["total_messages"] == 3
        assert "last_activity" in stats
    
    def test_cleanup_idle_sessions(self, agent_manager):
        """Test cleaning up idle sessions"""
        from datetime import datetime, timedelta
        
        # Create sessions with different timestamps
        recent_time = datetime.now().isoformat()
        old_time = (datetime.now() - timedelta(hours=2)).isoformat()
        
        agent_manager.active_sessions.update({
            "recent_session": {
                "agent_id": "agent1",
                "user_id": "user1",
                "messages": [],
                "last_activity": recent_time
            },
            "old_session": {
                "agent_id": "agent2",
                "user_id": "user2",
                "messages": [],
                "last_activity": old_time
            }
        })
        
        # Cleanup sessions older than 1 hour
        cleaned_count = agent_manager.cleanup_idle_sessions(max_idle_hours=1)
        
        assert cleaned_count == 1
        assert "recent_session" in agent_manager.active_sessions
        assert "old_session" not in agent_manager.active_sessions