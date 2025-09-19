# Myco AI Development Platform - Agent System

A comprehensive multi-agent system for automated software development, featuring specialized agents for planning, architecture, backend development, frontend development, and validation.

## 🚀 Overview

The Agent System provides end-to-end automated software development capabilities through a coordinated team of specialized AI agents. Each agent has specific expertise and works together to deliver complete, production-ready applications.

## 🏗️ Architecture

### Core Components

- **Base Agent Framework** (`base_agent.py`) - Foundation for all specialized agents
- **Workflow Engine** (`workflows/`) - Orchestrates multi-agent workflows
- **LLM Adapter** (`llm_adapter.py`) - Handles multiple LLM providers
- **Configuration** (`config.py`) - System-wide configuration management

### Specialized Agents

1. **Orchestrator Agent** (`orchestrator/`) - Master coordinator for complex workflows
2. **Planner Agent** (`planner/`) - Requirements analysis and project planning
3. **Architecture Agent** (`architecture/`) - System design and technology selection
4. **Backend Agent** (`backend/`) - Complete backend development with Encore.ts
5. **Frontend Agent** (`frontend/`) - React/TypeScript frontend development
6. **Validation Agent** (`validation/`) - Quality assurance and testing

## 🎯 Key Features

### ✅ Complete Project Lifecycle
- Requirements analysis and planning
- System architecture design
- Technology stack selection
- Full-stack development
- Quality validation and testing
- Deployment preparation

### ✅ Multiple Development Patterns
- **Full-Stack Web Applications** - Complete React + Encore.ts applications
- **Backend APIs** - RESTful APIs with database integration
- **Frontend SPAs** - Single-page applications with state management
- **Microservices** - Service-oriented architecture patterns
- **Quick Prototypes** - Rapid proof-of-concept development

### ✅ Production-Ready Code
- Type-safe TypeScript implementations
- Comprehensive error handling
- Security best practices
- Performance optimizations
- Complete test suites
- Documentation generation

### ✅ Quality Assurance
- Automated code quality validation
- Security vulnerability scanning
- Performance testing
- Functional testing
- Compliance checking
- Documentation validation

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export OPENAI_API_KEY="your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
```

### Basic Usage

```python
import asyncio
from agents.main_orchestrator import main_orchestrator

async def create_project():
    # Define project configuration
    project_config = {
        "name": "My Web App",
        "description": "A modern web application",
        "type": "full_stack_web_app",
        "requirements": {
            "features": ["user_auth", "dashboard", "api"],
            "scalability": "moderate",
            "performance": "high"
        },
        "tech_stack": ["React", "TypeScript", "Encore.ts"],
        "workspace_path": "/tmp/my_project"
    }
    
    # Create and develop project
    project = await main_orchestrator.create_project(project_config)
    result = await main_orchestrator.start_development(project["project_id"])
    
    print(f"Project completed: {result['status']}")
    print(f"Files generated: {result['files_generated']}")
    print(f"Quality score: {result['quality_score']}")

# Run the example
asyncio.run(create_project())
```

### Run Complete Demonstration

```bash
# Run all workflow examples
python -m agents.demo

# Or run specific examples
python -m agents.workflows.workflow_examples
```

## 📋 Workflow Templates

### 1. Full-Stack Web Application
Complete development workflow including:
- Requirements analysis and planning
- System architecture design
- Database schema design
- API structure design
- Backend implementation (Encore.ts)
- Frontend implementation (React/TypeScript)
- Integration testing
- Final validation

### 2. Backend API Development
Focused backend development including:
- API design and documentation
- Database modeling
- Authentication implementation
- Business logic development
- Comprehensive testing

### 3. Frontend SPA Development
Frontend-focused workflow including:
- UI/UX requirements analysis
- Component design and implementation
- State management setup
- Responsive design
- Frontend testing

### 4. Quick Prototype
Rapid prototyping workflow for:
- Concept validation
- Proof-of-concept development
- MVP creation
- Demo preparation

### 5. Microservices Architecture
Enterprise-scale development including:
- Service decomposition
- API gateway design
- Inter-service communication
- Service mesh configuration
- Deployment orchestration

## 🔧 Configuration

### LLM Providers
The system supports multiple LLM providers:

```python
# Configure in config.py
LLM_CONFIGS = {
    "primary": {
        "provider": "anthropic",
        "model": "claude-3-sonnet-20240229",
        "api_key": os.getenv("ANTHROPIC_API_KEY")
    },
    "secondary": {
        "provider": "openai", 
        "model": "gpt-4-turbo-preview",
        "api_key": os.getenv("OPENAI_API_KEY")
    }
}
```

### Agent Configuration
```python
AGENT_CONFIG = {
    "max_concurrent_tasks": 5,
    "task_timeout": 300,
    "retry_attempts": 3,
    "performance_tracking": True
}
```

## 🧪 Testing and Validation

### Code Quality Validation
- ESLint/TSLint analysis
- Type checking (TypeScript)
- Complexity analysis
- Test coverage measurement
- Dependency auditing

### Security Validation
- Vulnerability scanning
- Secret detection
- Dependency security analysis
- Configuration security checks

### Performance Testing
- Load testing
- Memory analysis
- Response time measurement
- Resource utilization monitoring

### Functional Testing
- Unit test execution
- Integration testing
- End-to-end testing
- API testing

## 📁 Project Structure

```
agents/
├── README.md                    # This file
├── __init__.py                  # Package initialization
├── base_agent.py               # Base agent framework
├── config.py                   # Configuration management
├── llm_adapter.py              # LLM provider abstraction
├── main_orchestrator.py       # Main system interface
├── demo.py                     # Complete demonstration
│
├── orchestrator/               # Master orchestration
│   └── orchestrator_agent.py
│
├── planner/                    # Project planning
│   └── planner_agent.py
│
├── architecture/               # System architecture
│   └── architecture_agent.py
│
├── backend/                    # Backend development
│   ├── backend_agent.py
│   └── enhanced_backend_agent.py
│
├── frontend/                   # Frontend development
│   └── frontend_agent.py
│
├── validation/                 # Quality assurance
│   └── validation_agent.py
│
└── workflows/                  # Workflow management
    ├── __init__.py
    ├── workflow_engine.py      # Workflow execution engine
    ├── predefined_workflows.py # Workflow templates
    ├── workflow_examples.py    # Example workflows
    └── README.md
```

## 🔄 Workflow Execution

### Workflow Creation
```python
# Create custom workflow
workflow_id = workflow_engine.create_workflow(
    name="Custom Development Workflow",
    description="Tailored development process",
    steps=[
        {
            "id": "analysis",
            "name": "Requirements Analysis", 
            "agent_type": "planner",
            "task_type": "analyze_requirements",
            "inputs": {"requirements": requirements},
            "dependencies": []
        },
        # ... more steps
    ],
    context=execution_context
)

# Execute workflow
result = await workflow_engine.execute_workflow(workflow_id)
```

### Workflow Monitoring
```python
# Get workflow status
status = workflow_engine.get_workflow_status(workflow_id)

# List all workflows
workflows = workflow_engine.list_workflows()

# Cancel running workflow
workflow_engine.cancel_workflow(workflow_id)
```

## 🎯 Use Cases

### Enterprise Application Development
- Large-scale web applications
- Microservices architectures
- API-first development
- Enterprise integration patterns

### Rapid Prototyping
- MVP development
- Proof-of-concept applications
- Demo preparation
- Feature validation

### Educational Projects
- Learning full-stack development
- Understanding system architecture
- Exploring best practices
- Code quality improvement

### Code Modernization
- Legacy system upgrades
- Technology migration
- Architecture refactoring
- Quality improvements

## 🛠️ Customization

### Creating Custom Agents
```python
from agents.base_agent import BaseAgent, AgentType

class CustomAgent(BaseAgent):
    def __init__(self):
        super().__init__("custom-001", AgentType.CUSTOM)
        self.capabilities = ["custom_capability"]
    
    async def execute_task(self, task, context):
        # Custom implementation
        return {"result": "custom_output"}
    
    def can_handle_task(self, task):
        return task.type in ["custom_task_type"]
```

### Custom Workflow Templates
```python
def custom_workflow_template():
    return {
        "name": "Custom Workflow",
        "description": "Custom development process",
        "steps": [
            {
                "id": "custom_step",
                "name": "Custom Step",
                "agent_type": "custom",
                "task_type": "custom_task",
                "inputs": {},
                "dependencies": []
            }
        ]
    }
```

## 📊 Metrics and Monitoring

### Performance Metrics
- Task execution times
- Success/failure rates
- Resource utilization
- Quality scores

### Quality Metrics
- Code quality scores
- Test coverage percentages
- Security vulnerability counts
- Documentation completeness

### Project Metrics
- Files generated
- Lines of code
- Complexity measurements
- Delivery timelines

## 🔗 Integration

### CI/CD Integration
```bash
# GitHub Actions example
- name: Run Agent System Validation
  run: |
    python -m agents.validation.validation_agent \
      --project-path . \
      --config .agents/validation.json
```

### API Integration
```python
# REST API integration
import requests

response = requests.post('/api/projects', json={
    "name": "API Project",
    "type": "backend_api_only",
    "requirements": {...}
})

project_id = response.json()['project_id']
```

## 🚨 Troubleshooting

### Common Issues

1. **LLM API Rate Limits**
   - Configure retry logic
   - Use multiple provider fallbacks
   - Implement request queuing

2. **Large File Generation**
   - Monitor workspace disk usage
   - Implement file size limits
   - Use streaming for large outputs

3. **Workflow Failures**
   - Check agent logs
   - Validate input data
   - Review dependency resolution

### Debug Mode
```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Run with detailed output
result = await main_orchestrator.start_development(
    project_id, 
    debug=True
)
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests and documentation
5. Submit a pull request

### Development Setup
```bash
# Clone repository
git clone <repository-url>
cd agents

# Install development dependencies
pip install -r requirements-dev.txt

# Run tests
python -m pytest tests/

# Run demo
python -m agents.demo
```

## 📜 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🎉 Getting Started

Ready to experience the future of automated software development?

1. **Run the demo**: `python -m agents.demo`
2. **Try an example**: `python -m agents.workflows.workflow_examples`
3. **Create your first project**: Use the `main_orchestrator.create_project()` API
4. **Explore workflows**: Check out the predefined workflow templates
5. **Customize**: Create your own agents and workflows

The Agent System is designed to handle the full complexity of modern software development while maintaining the flexibility to adapt to your specific needs. Whether you're building a simple prototype or a complex enterprise application, the agents work together to deliver high-quality, production-ready code.

---

**Built with ❤️ by the Myco AI Development Platform Team**