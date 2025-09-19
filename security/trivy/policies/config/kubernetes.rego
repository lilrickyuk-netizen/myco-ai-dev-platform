# Trivy Custom Kubernetes Security Policies

package kubernetes.security

import data.lib.kubernetes

# Security Context Policies
deny[msg] {
    input.kind == "Pod"
    input.spec.securityContext.runAsUser == 0
    msg := "Container should not run as root user (UID 0)"
}

deny[msg] {
    input.kind == "Deployment"
    input.spec.template.spec.securityContext.runAsUser == 0
    msg := "Container should not run as root user (UID 0)"
}

# Privileged containers
deny[msg] {
    input.kind == "Pod"
    input.spec.containers[_].securityContext.privileged == true
    msg := "Privileged containers are not allowed"
}

deny[msg] {
    input.kind == "Deployment"
    input.spec.template.spec.containers[_].securityContext.privileged == true
    msg := "Privileged containers are not allowed"
}

# Host network usage
deny[msg] {
    input.kind == "Pod"
    input.spec.hostNetwork == true
    msg := "Host network should not be used"
}

deny[msg] {
    input.kind == "Deployment"
    input.spec.template.spec.hostNetwork == true
    msg := "Host network should not be used"
}

# Resource limits
warn[msg] {
    input.kind == "Pod"
    container := input.spec.containers[_]
    not container.resources.limits.memory
    msg := sprintf("Container '%s' should have memory limits set", [container.name])
}

warn[msg] {
    input.kind == "Deployment"
    container := input.spec.template.spec.containers[_]
    not container.resources.limits.memory
    msg := sprintf("Container '%s' should have memory limits set", [container.name])
}

warn[msg] {
    input.kind == "Pod"
    container := input.spec.containers[_]
    not container.resources.limits.cpu
    msg := sprintf("Container '%s' should have CPU limits set", [container.name])
}

# ReadOnlyRootFilesystem
warn[msg] {
    input.kind == "Pod"
    container := input.spec.containers[_]
    not container.securityContext.readOnlyRootFilesystem
    msg := sprintf("Container '%s' should have readOnlyRootFilesystem set to true", [container.name])
}

# AllowPrivilegeEscalation
deny[msg] {
    input.kind == "Pod"
    container := input.spec.containers[_]
    container.securityContext.allowPrivilegeEscalation == true
    msg := sprintf("Container '%s' should not allow privilege escalation", [container.name])
}

# Capabilities
deny[msg] {
    input.kind == "Pod"
    container := input.spec.containers[_]
    "SYS_ADMIN" in container.securityContext.capabilities.add
    msg := sprintf("Container '%s' should not have SYS_ADMIN capability", [container.name])
}

# Image pull policy
warn[msg] {
    input.kind == "Pod"
    container := input.spec.containers[_]
    container.imagePullPolicy != "Always"
    not contains(container.image, ":")
    msg := sprintf("Container '%s' should use 'Always' pull policy or specify image tag", [container.name])
}

# Service account
warn[msg] {
    input.kind == "Pod"
    input.spec.serviceAccountName == "default"
    msg := "Pod should not use default service account"
}

# Network policies
warn[msg] {
    input.kind == "Namespace"
    not has_network_policy
    msg := "Namespace should have network policies defined"
}

has_network_policy {
    # This would need to check if NetworkPolicy exists for the namespace
    # Implementation depends on available data
    true
}