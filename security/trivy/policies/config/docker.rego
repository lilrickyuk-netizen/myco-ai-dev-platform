# Trivy Custom Docker Security Policies

package docker.security

import data.lib.docker

# Deny running as root user
deny[msg] {
    input.Config.User == ""
    msg := "Container should not run as root user. Specify a non-root USER directive."
}

deny[msg] {
    input.Config.User == "0"
    msg := "Container should not run as root user (UID 0). Specify a non-root USER directive."
}

deny[msg] {
    input.Config.User == "root"
    msg := "Container should not run as root user. Specify a non-root USER directive."
}

# Check for sensitive files in the image
deny[msg] {
    input.RootFS.DiffIDs
    sensitive_files := [
        "/etc/passwd",
        "/etc/shadow",
        "/root/.ssh/",
        "/home/*/.ssh/",
        "*.key",
        "*.pem",
        ".env"
    ]
    
    file := sensitive_files[_]
    contains(input.Config.Env[_], file)
    msg := sprintf("Sensitive file '%s' detected in environment variables", [file])
}

# Ensure HEALTHCHECK is defined
warn[msg] {
    not input.Config.Healthcheck
    msg := "Container should define a HEALTHCHECK instruction for better monitoring"
}

# Check for exposed sensitive ports
deny[msg] {
    sensitive_ports := ["22", "3389", "5432", "3306", "6379", "27017"]
    port := sensitive_ports[_]
    input.Config.ExposedPorts[sprintf("%s/tcp", [port])]
    msg := sprintf("Sensitive port %s should not be exposed", [port])
}

# Ensure non-root user
warn[msg] {
    input.Config.User == ""
    msg := "Consider specifying a non-root user with USER directive"
}

# Check for unnecessary packages
deny[msg] {
    unnecessary_packages := ["telnet", "ftp", "wget", "curl"]
    # This would need to be checked against installed packages
    # Implementation depends on package manager and base image
    msg := "Unnecessary packages detected. Remove unused packages to reduce attack surface."
}