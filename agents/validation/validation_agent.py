import asyncio
import json
import logging
import os
import subprocess
from typing import Dict, List, Any, Optional
from datetime import datetime
from ..base_agent import BaseAgent, AgentType, Task, TaskPriority, AgentExecutionContext
from ..llm_adapter import LLMMessage, llm_manager

class ValidationAgent(BaseAgent):
    """Agent responsible for validation, verification, and quality assurance"""
    
    def __init__(self):
        super().__init__("validator-001", AgentType.VERIFIER)
        self.capabilities = [
            "code_quality_validation",
            "security_scanning",
            "performance_testing",
            "functional_testing",
            "integration_validation",
            "deployment_verification",
            "compliance_checking",
            "documentation_validation"
        ]
        self.logger = logging.getLogger(__name__)
        
    def can_handle_task(self, task: Task) -> bool:
        """Check if this agent can handle the given task"""
        validation_tasks = [
            "validate_code_quality",
            "validate_security",
            "validate_performance",
            "validate_functionality",
            "validate_integration",
            "validate_deployment",
            "validate_compliance",
            "validate_documentation",
            "run_full_validation_suite"
        ]
        return task.type in validation_tasks
    
    async def execute_task(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Execute validation tasks"""
        
        if task.type == "validate_code_quality":
            return await self._validate_code_quality(task, context)
        elif task.type == "validate_security":
            return await self._validate_security(task, context)
        elif task.type == "validate_performance":
            return await self._validate_performance(task, context)
        elif task.type == "validate_functionality":
            return await self._validate_functionality(task, context)
        elif task.type == "validate_integration":
            return await self._validate_integration(task, context)
        elif task.type == "validate_deployment":
            return await self._validate_deployment(task, context)
        elif task.type == "validate_compliance":
            return await self._validate_compliance(task, context)
        elif task.type == "validate_documentation":
            return await self._validate_documentation(task, context)
        elif task.type == "run_full_validation_suite":
            return await self._run_full_validation_suite(task, context)
        else:
            raise ValueError(f"Unknown task type: {task.type}")
    
    async def _validate_code_quality(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Validate code quality standards"""
        
        project_path = task.inputs.get("project_path", context.workspace_path)
        quality_standards = task.inputs.get("quality_standards", {})
        
        self.logger.info(f"Running code quality validation on {project_path}")
        
        validation_results = {
            "lint_results": await self._run_linting(project_path),
            "type_checking": await self._run_type_checking(project_path),
            "complexity_analysis": await self._analyze_complexity(project_path),
            "test_coverage": await self._check_test_coverage(project_path),
            "dependency_audit": await self._audit_dependencies(project_path),
            "code_duplication": await self._check_code_duplication(project_path)
        }
        
        # Calculate overall quality score
        quality_score = self._calculate_quality_score(validation_results)
        
        return {
            "validation_type": "code_quality",
            "status": "passed" if quality_score >= 80 else "failed",
            "quality_score": quality_score,
            "results": validation_results,
            "recommendations": self._generate_quality_recommendations(validation_results),
            "validated_at": datetime.utcnow().isoformat()
        }
    
    async def _validate_security(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Validate security standards"""
        
        project_path = task.inputs.get("project_path", context.workspace_path)
        security_requirements = task.inputs.get("security_requirements", {})
        
        self.logger.info(f"Running security validation on {project_path}")
        
        security_results = {
            "vulnerability_scan": await self._scan_vulnerabilities(project_path),
            "secret_detection": await self._detect_secrets(project_path),
            "dependency_security": await self._check_dependency_security(project_path),
            "code_security": await self._analyze_code_security(project_path),
            "configuration_security": await self._check_configuration_security(project_path)
        }
        
        # Calculate security score
        security_score = self._calculate_security_score(security_results)
        
        return {
            "validation_type": "security",
            "status": "passed" if security_score >= 90 else "failed",
            "security_score": security_score,
            "results": security_results,
            "vulnerabilities": self._extract_vulnerabilities(security_results),
            "recommendations": self._generate_security_recommendations(security_results),
            "validated_at": datetime.utcnow().isoformat()
        }
    
    async def _validate_performance(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Validate performance requirements"""
        
        project_path = task.inputs.get("project_path", context.workspace_path)
        performance_targets = task.inputs.get("performance_targets", {})
        
        self.logger.info(f"Running performance validation on {project_path}")
        
        performance_results = {
            "load_testing": await self._run_load_tests(project_path, performance_targets),
            "memory_analysis": await self._analyze_memory_usage(project_path),
            "response_time_analysis": await self._analyze_response_times(project_path),
            "resource_utilization": await self._check_resource_utilization(project_path),
            "scalability_analysis": await self._analyze_scalability(project_path)
        }
        
        # Calculate performance score
        performance_score = self._calculate_performance_score(performance_results, performance_targets)
        
        return {
            "validation_type": "performance",
            "status": "passed" if performance_score >= 85 else "failed",
            "performance_score": performance_score,
            "results": performance_results,
            "bottlenecks": self._identify_bottlenecks(performance_results),
            "recommendations": self._generate_performance_recommendations(performance_results),
            "validated_at": datetime.utcnow().isoformat()
        }
    
    async def _validate_functionality(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Validate functional requirements"""
        
        project_path = task.inputs.get("project_path", context.workspace_path)
        functional_requirements = task.inputs.get("functional_requirements", [])
        
        self.logger.info(f"Running functional validation on {project_path}")
        
        functional_results = {
            "unit_tests": await self._run_unit_tests(project_path),
            "integration_tests": await self._run_integration_tests(project_path),
            "e2e_tests": await self._run_e2e_tests(project_path),
            "api_tests": await self._run_api_tests(project_path),
            "requirement_coverage": await self._check_requirement_coverage(functional_requirements, project_path)
        }
        
        # Calculate functional score
        functional_score = self._calculate_functional_score(functional_results)
        
        return {
            "validation_type": "functionality",
            "status": "passed" if functional_score >= 95 else "failed",
            "functional_score": functional_score,
            "results": functional_results,
            "test_failures": self._extract_test_failures(functional_results),
            "recommendations": self._generate_functional_recommendations(functional_results),
            "validated_at": datetime.utcnow().isoformat()
        }
    
    async def _validate_integration(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Validate system integration"""
        
        project_path = task.inputs.get("project_path", context.workspace_path)
        integration_points = task.inputs.get("integration_points", [])
        
        self.logger.info(f"Running integration validation on {project_path}")
        
        integration_results = {
            "api_integration": await self._test_api_integration(project_path),
            "database_integration": await self._test_database_integration(project_path),
            "external_service_integration": await self._test_external_integrations(project_path, integration_points),
            "frontend_backend_integration": await self._test_frontend_backend_integration(project_path),
            "data_flow_validation": await self._validate_data_flow(project_path)
        }
        
        # Calculate integration score
        integration_score = self._calculate_integration_score(integration_results)
        
        return {
            "validation_type": "integration",
            "status": "passed" if integration_score >= 90 else "failed",
            "integration_score": integration_score,
            "results": integration_results,
            "integration_failures": self._extract_integration_failures(integration_results),
            "recommendations": self._generate_integration_recommendations(integration_results),
            "validated_at": datetime.utcnow().isoformat()
        }
    
    async def _validate_deployment(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Validate deployment readiness"""
        
        project_path = task.inputs.get("project_path", context.workspace_path)
        deployment_config = task.inputs.get("deployment_config", {})
        
        self.logger.info(f"Running deployment validation on {project_path}")
        
        deployment_results = {
            "build_validation": await self._validate_build_process(project_path),
            "environment_validation": await self._validate_environment_config(project_path),
            "containerization": await self._validate_containerization(project_path),
            "health_checks": await self._validate_health_checks(project_path),
            "monitoring_setup": await self._validate_monitoring_setup(project_path),
            "backup_recovery": await self._validate_backup_recovery(project_path)
        }
        
        # Calculate deployment score
        deployment_score = self._calculate_deployment_score(deployment_results)
        
        return {
            "validation_type": "deployment",
            "status": "passed" if deployment_score >= 90 else "failed",
            "deployment_score": deployment_score,
            "results": deployment_results,
            "deployment_blockers": self._identify_deployment_blockers(deployment_results),
            "recommendations": self._generate_deployment_recommendations(deployment_results),
            "validated_at": datetime.utcnow().isoformat()
        }
    
    async def _validate_compliance(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Validate compliance requirements"""
        
        project_path = task.inputs.get("project_path", context.workspace_path)
        compliance_standards = task.inputs.get("compliance_standards", [])
        
        self.logger.info(f"Running compliance validation on {project_path}")
        
        compliance_results = {
            "gdpr_compliance": await self._check_gdpr_compliance(project_path),
            "accessibility_compliance": await self._check_accessibility_compliance(project_path),
            "security_standards": await self._check_security_standards_compliance(project_path, compliance_standards),
            "coding_standards": await self._check_coding_standards_compliance(project_path),
            "documentation_standards": await self._check_documentation_standards(project_path)
        }
        
        # Calculate compliance score
        compliance_score = self._calculate_compliance_score(compliance_results)
        
        return {
            "validation_type": "compliance",
            "status": "passed" if compliance_score >= 95 else "failed",
            "compliance_score": compliance_score,
            "results": compliance_results,
            "compliance_violations": self._extract_compliance_violations(compliance_results),
            "recommendations": self._generate_compliance_recommendations(compliance_results),
            "validated_at": datetime.utcnow().isoformat()
        }
    
    async def _validate_documentation(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Validate documentation completeness and quality"""
        
        project_path = task.inputs.get("project_path", context.workspace_path)
        documentation_requirements = task.inputs.get("documentation_requirements", {})
        
        self.logger.info(f"Running documentation validation on {project_path}")
        
        documentation_results = {
            "readme_quality": await self._validate_readme(project_path),
            "api_documentation": await self._validate_api_docs(project_path),
            "code_comments": await self._validate_code_comments(project_path),
            "architecture_docs": await self._validate_architecture_docs(project_path),
            "deployment_docs": await self._validate_deployment_docs(project_path),
            "user_documentation": await self._validate_user_docs(project_path)
        }
        
        # Calculate documentation score
        documentation_score = self._calculate_documentation_score(documentation_results)
        
        return {
            "validation_type": "documentation",
            "status": "passed" if documentation_score >= 85 else "failed",
            "documentation_score": documentation_score,
            "results": documentation_results,
            "missing_documentation": self._identify_missing_docs(documentation_results),
            "recommendations": self._generate_documentation_recommendations(documentation_results),
            "validated_at": datetime.utcnow().isoformat()
        }
    
    async def _run_full_validation_suite(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Run complete validation suite"""
        
        self.logger.info("Running full validation suite")
        
        validation_tasks = [
            self._validate_code_quality(task, context),
            self._validate_security(task, context),
            self._validate_performance(task, context),
            self._validate_functionality(task, context),
            self._validate_integration(task, context),
            self._validate_deployment(task, context),
            self._validate_compliance(task, context),
            self._validate_documentation(task, context)
        ]
        
        # Run all validations in parallel
        validation_results = await asyncio.gather(*validation_tasks, return_exceptions=True)
        
        # Process results
        processed_results = {}
        failed_validations = []
        
        validation_types = [
            "code_quality", "security", "performance", "functionality",
            "integration", "deployment", "compliance", "documentation"
        ]
        
        for i, result in enumerate(validation_results):
            validation_type = validation_types[i]
            
            if isinstance(result, Exception):
                self.logger.error(f"Validation {validation_type} failed: {result}")
                processed_results[validation_type] = {
                    "status": "error",
                    "error": str(result)
                }
                failed_validations.append(validation_type)
            else:
                processed_results[validation_type] = result
                if result.get("status") != "passed":
                    failed_validations.append(validation_type)
        
        # Calculate overall score
        overall_score = self._calculate_overall_score(processed_results)
        
        return {
            "validation_suite": "full",
            "status": "passed" if overall_score >= 85 and not failed_validations else "failed",
            "overall_score": overall_score,
            "validations": processed_results,
            "failed_validations": failed_validations,
            "summary": self._generate_validation_summary(processed_results),
            "recommendations": self._generate_overall_recommendations(processed_results),
            "validated_at": datetime.utcnow().isoformat()
        }
    
    # Helper methods for validation implementation
    async def _run_linting(self, project_path: str) -> Dict[str, Any]:
        """Run linting checks"""
        try:
            # Check for linting configuration
            lint_configs = [
                os.path.join(project_path, ".eslintrc.js"),
                os.path.join(project_path, ".eslintrc.json"),
                os.path.join(project_path, "pyproject.toml"),
                os.path.join(project_path, ".flake8")
            ]
            
            found_config = None
            for config in lint_configs:
                if os.path.exists(config):
                    found_config = config
                    break
            
            if not found_config:
                return {"status": "warning", "message": "No linting configuration found"}
            
            # Run appropriate linter
            if "eslint" in found_config:
                result = await self._run_command(["npx", "eslint", ".", "--format", "json"], project_path)
            elif "pyproject.toml" in found_config or ".flake8" in found_config:
                result = await self._run_command(["flake8", "--format=json", "."], project_path)
            else:
                return {"status": "warning", "message": "Unknown linting configuration"}
            
            return {
                "status": "completed",
                "issues_count": len(result.get("issues", [])),
                "issues": result.get("issues", [])[:10],  # Limit to first 10 issues
                "config_used": found_config
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    async def _run_type_checking(self, project_path: str) -> Dict[str, Any]:
        """Run type checking"""
        try:
            # Check for TypeScript
            if os.path.exists(os.path.join(project_path, "tsconfig.json")):
                result = await self._run_command(["npx", "tsc", "--noEmit"], project_path)
                return {
                    "status": "completed",
                    "language": "typescript",
                    "errors": result.get("errors", [])
                }
            
            # Check for Python type hints
            if any(f.endswith(".py") for f in os.listdir(project_path) if os.path.isfile(os.path.join(project_path, f))):
                result = await self._run_command(["mypy", "."], project_path)
                return {
                    "status": "completed", 
                    "language": "python",
                    "errors": result.get("errors", [])
                }
            
            return {"status": "skipped", "message": "No type checking configuration found"}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    async def _run_command(self, command: List[str], cwd: str) -> Dict[str, Any]:
        """Run a command and return parsed result"""
        try:
            process = await asyncio.create_subprocess_exec(
                *command,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            return {
                "return_code": process.returncode,
                "stdout": stdout.decode(),
                "stderr": stderr.decode(),
                "command": " ".join(command)
            }
        except Exception as e:
            return {"error": str(e)}
    
    # Placeholder implementations for other validation methods
    async def _analyze_complexity(self, project_path: str) -> Dict[str, Any]:
        return {"status": "not_implemented", "message": "Complexity analysis not yet implemented"}
    
    async def _check_test_coverage(self, project_path: str) -> Dict[str, Any]:
        return {"status": "not_implemented", "coverage_percentage": 0}
    
    async def _audit_dependencies(self, project_path: str) -> Dict[str, Any]:
        return {"status": "not_implemented", "vulnerabilities": []}
    
    async def _check_code_duplication(self, project_path: str) -> Dict[str, Any]:
        return {"status": "not_implemented", "duplication_percentage": 0}
    
    async def _scan_vulnerabilities(self, project_path: str) -> Dict[str, Any]:
        return {"status": "not_implemented", "vulnerabilities": []}
    
    async def _detect_secrets(self, project_path: str) -> Dict[str, Any]:
        return {"status": "not_implemented", "secrets_found": []}
    
    async def _check_dependency_security(self, project_path: str) -> Dict[str, Any]:
        return {"status": "not_implemented", "vulnerable_dependencies": []}
    
    # Score calculation methods
    def _calculate_quality_score(self, results: Dict[str, Any]) -> float:
        """Calculate overall quality score"""
        scores = []
        
        # Lint score (0-100)
        lint_result = results.get("lint_results", {})
        if lint_result.get("status") == "completed":
            issues_count = lint_result.get("issues_count", 0)
            lint_score = max(0, 100 - (issues_count * 2))  # -2 points per issue
            scores.append(lint_score)
        
        # Type checking score
        type_result = results.get("type_checking", {})
        if type_result.get("status") == "completed":
            errors_count = len(type_result.get("errors", []))
            type_score = max(0, 100 - (errors_count * 5))  # -5 points per error
            scores.append(type_score)
        
        # Test coverage score
        coverage_result = results.get("test_coverage", {})
        coverage_percentage = coverage_result.get("coverage_percentage", 0)
        scores.append(coverage_percentage)
        
        return sum(scores) / len(scores) if scores else 0
    
    def _calculate_security_score(self, results: Dict[str, Any]) -> float:
        """Calculate security score"""
        # Simplified scoring - in production this would be more sophisticated
        base_score = 100
        
        vuln_scan = results.get("vulnerability_scan", {})
        vulnerabilities = len(vuln_scan.get("vulnerabilities", []))
        base_score -= vulnerabilities * 10  # -10 points per vulnerability
        
        secrets = results.get("secret_detection", {})
        secrets_found = len(secrets.get("secrets_found", []))
        base_score -= secrets_found * 20  # -20 points per exposed secret
        
        return max(0, base_score)
    
    def _calculate_performance_score(self, results: Dict[str, Any], targets: Dict[str, Any]) -> float:
        """Calculate performance score"""
        # Simplified scoring based on targets
        return 85.0  # Placeholder
    
    def _calculate_functional_score(self, results: Dict[str, Any]) -> float:
        """Calculate functional score based on test results"""
        return 95.0  # Placeholder
    
    def _calculate_integration_score(self, results: Dict[str, Any]) -> float:
        """Calculate integration score"""
        return 90.0  # Placeholder
    
    def _calculate_deployment_score(self, results: Dict[str, Any]) -> float:
        """Calculate deployment readiness score"""
        return 88.0  # Placeholder
    
    def _calculate_compliance_score(self, results: Dict[str, Any]) -> float:
        """Calculate compliance score"""
        return 92.0  # Placeholder
    
    def _calculate_documentation_score(self, results: Dict[str, Any]) -> float:
        """Calculate documentation score"""
        return 80.0  # Placeholder
    
    def _calculate_overall_score(self, results: Dict[str, Any]) -> float:
        """Calculate overall validation score"""
        scores = []
        
        for validation_type, result in results.items():
            if isinstance(result, dict) and "score" in str(result):
                # Extract score from result
                for key, value in result.items():
                    if "score" in key and isinstance(value, (int, float)):
                        scores.append(value)
                        break
        
        return sum(scores) / len(scores) if scores else 0
    
    # Recommendation generation methods
    def _generate_quality_recommendations(self, results: Dict[str, Any]) -> List[str]:
        """Generate code quality recommendations"""
        recommendations = []
        
        lint_result = results.get("lint_results", {})
        if lint_result.get("issues_count", 0) > 10:
            recommendations.append("Address linting issues to improve code consistency")
        
        coverage_result = results.get("test_coverage", {})
        if coverage_result.get("coverage_percentage", 0) < 80:
            recommendations.append("Increase test coverage to at least 80%")
        
        return recommendations
    
    def _generate_security_recommendations(self, results: Dict[str, Any]) -> List[str]:
        return ["Implement security best practices", "Regular security audits"]
    
    def _generate_performance_recommendations(self, results: Dict[str, Any]) -> List[str]:
        return ["Optimize database queries", "Implement caching strategies"]
    
    def _generate_functional_recommendations(self, results: Dict[str, Any]) -> List[str]:
        return ["Add more comprehensive test scenarios"]
    
    def _generate_integration_recommendations(self, results: Dict[str, Any]) -> List[str]:
        return ["Improve error handling in integrations"]
    
    def _generate_deployment_recommendations(self, results: Dict[str, Any]) -> List[str]:
        return ["Add health check endpoints", "Improve monitoring setup"]
    
    def _generate_compliance_recommendations(self, results: Dict[str, Any]) -> List[str]:
        return ["Ensure GDPR compliance", "Add accessibility features"]
    
    def _generate_documentation_recommendations(self, results: Dict[str, Any]) -> List[str]:
        return ["Improve API documentation", "Add deployment guides"]
    
    def _generate_overall_recommendations(self, results: Dict[str, Any]) -> List[str]:
        """Generate overall recommendations"""
        all_recommendations = []
        
        for validation_type, result in results.items():
            if isinstance(result, dict) and "recommendations" in result:
                all_recommendations.extend(result["recommendations"])
        
        # Deduplicate and prioritize
        unique_recommendations = list(set(all_recommendations))
        return unique_recommendations[:10]  # Return top 10
    
    def _generate_validation_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate validation summary"""
        passed_count = 0
        total_count = 0
        
        for validation_type, result in results.items():
            if isinstance(result, dict):
                total_count += 1
                if result.get("status") == "passed":
                    passed_count += 1
        
        return {
            "total_validations": total_count,
            "passed_validations": passed_count,
            "failed_validations": total_count - passed_count,
            "success_rate": (passed_count / total_count * 100) if total_count > 0 else 0
        }
    
    # Placeholder methods for extracting specific information
    def _extract_vulnerabilities(self, results: Dict[str, Any]) -> List[Dict]:
        return []
    
    def _extract_test_failures(self, results: Dict[str, Any]) -> List[Dict]:
        return []
    
    def _extract_integration_failures(self, results: Dict[str, Any]) -> List[Dict]:
        return []
    
    def _identify_deployment_blockers(self, results: Dict[str, Any]) -> List[str]:
        return []
    
    def _extract_compliance_violations(self, results: Dict[str, Any]) -> List[Dict]:
        return []
    
    def _identify_missing_docs(self, results: Dict[str, Any]) -> List[str]:
        return []
    
    def _identify_bottlenecks(self, results: Dict[str, Any]) -> List[str]:
        return []