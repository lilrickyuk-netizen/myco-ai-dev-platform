# Myco Control Plane

The `.myco/` directory contains the control plane for the Myco multi-agent system, providing complete transparency and auditability for all AI-powered project generation.

## Structure

```
.myco/
├── inputs.json              # User requirements and inputs
├── llm_decisions.json       # Complete audit trail of all LLM decisions
├── verification.json        # Quality verification results
├── run_report.md           # Human-readable generation report
├── agents/                 # Agent-specific logs and outputs
├── metrics/                # Performance and quality metrics
├── artifacts/              # Generated artifacts and intermediate files
└── config/                 # Control plane configuration
```

## Purpose

- **Transparency**: Every AI decision is logged and auditable
- **Reproducibility**: Complete trace of project generation
- **Quality Assurance**: Verification of completeness and correctness
- **Performance Monitoring**: Agent performance metrics
- **Debugging**: Detailed logs for troubleshooting
- **Compliance**: Audit trail for regulatory requirements

## Data Flow

1. User inputs → `inputs.json`
2. Agent decisions → `llm_decisions.json` 
3. Generated artifacts → `artifacts/`
4. Quality checks → `verification.json`
5. Final report → `run_report.md`