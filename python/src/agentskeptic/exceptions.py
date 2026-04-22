"""Public errors for integrators."""


class AgentSkepticError(Exception):
    """Base error."""

    pass


class DecisionUnsafeError(AgentSkepticError):
    """Raised when verification blocks an irreversible action (contract_sql)."""

    def __init__(self, message: str, *, certificate: dict | None = None) -> None:
        super().__init__(message)
        self.certificate = certificate


class LangGraphCheckpointTrustUnsafeError(AgentSkepticError):
    """Raised when LangGraph checkpoint production gate fails (row B not satisfied)."""

    def __init__(self, message: str, *, certificate: dict | None = None) -> None:
        super().__init__(message)
        self.certificate = certificate
