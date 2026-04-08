# Security

## Supported versions

Security updates are applied to the **default branch** of this repository. Use the latest commit or published release you trust.

## Reporting a vulnerability

Please **do not** file a public GitHub issue for undisclosed security vulnerabilities.

Instead, report privately:

1. Open a **GitHub Security Advisory** for this repository (preferred if enabled), or  
2. Contact the maintainers through a private channel they have published for this project.

Include:

- A short description of the issue and its impact  
- Steps to reproduce (proof-of-concept if possible)  
- Affected versions or commit range if known  

We will work with you to understand and address the report before public disclosure.

## Scope notes

This tool runs **read-only SQL** against databases you configure and processes **local files** (events, registry, etc.). Threat models should account for **untrusted input files**, **database connectivity**, and **supply chain** (dependencies) like any Node.js CLI.
