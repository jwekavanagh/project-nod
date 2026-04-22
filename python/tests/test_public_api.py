def test_only_documented_public_exports() -> None:
    import agentskeptic

    assert set(agentskeptic.__all__) == {
        "verify",
        "emit_tools_json",
        "AgentSkepticError",
        "DecisionUnsafeError",
        "LangGraphCheckpointTrustUnsafeError",
    }
    for name in agentskeptic.__all__:
        assert hasattr(agentskeptic, name)


def test_verify_is_context_manager() -> None:
    import inspect

    from agentskeptic import verify

    assert "yield" in inspect.getsource(verify)
