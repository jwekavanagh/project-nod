# Commercial entitlement matrix (generated)

Do not edit by hand. Source: `config/commercial-entitlement-matrix.v1.json`.
Regenerate with `node scripts/sync-commercial-entitlement-doc.mjs`.

| plan | subscriptionStatus | intent | emergencyAllow | expectProceedToQuota | expectedDenyCode |
|------|------------------|--------|----------------|----------------------|------------------|
| starter | none | verify | false | false | VERIFICATION_REQUIRES_SUBSCRIPTION |
| starter | none | verify | true | false | VERIFICATION_REQUIRES_SUBSCRIPTION |
| starter | none | enforce | false | false | ENFORCEMENT_REQUIRES_PAID_PLAN |
| starter | none | enforce | true | false | ENFORCEMENT_REQUIRES_PAID_PLAN |
| starter | active | verify | false | false | VERIFICATION_REQUIRES_SUBSCRIPTION |
| starter | active | verify | true | false | VERIFICATION_REQUIRES_SUBSCRIPTION |
| starter | active | enforce | false | false | ENFORCEMENT_REQUIRES_PAID_PLAN |
| starter | active | enforce | true | false | ENFORCEMENT_REQUIRES_PAID_PLAN |
| starter | inactive | verify | false | false | VERIFICATION_REQUIRES_SUBSCRIPTION |
| starter | inactive | verify | true | false | VERIFICATION_REQUIRES_SUBSCRIPTION |
| starter | inactive | enforce | false | false | ENFORCEMENT_REQUIRES_PAID_PLAN |
| starter | inactive | enforce | true | false | ENFORCEMENT_REQUIRES_PAID_PLAN |
| individual | none | verify | false | false | SUBSCRIPTION_INACTIVE |
| individual | none | verify | true | true | null |
| individual | none | enforce | false | false | SUBSCRIPTION_INACTIVE |
| individual | none | enforce | true | true | null |
| individual | active | verify | false | true | null |
| individual | active | verify | true | true | null |
| individual | active | enforce | false | true | null |
| individual | active | enforce | true | true | null |
| individual | inactive | verify | false | false | SUBSCRIPTION_INACTIVE |
| individual | inactive | verify | true | true | null |
| individual | inactive | enforce | false | false | SUBSCRIPTION_INACTIVE |
| individual | inactive | enforce | true | true | null |
| team | none | verify | false | false | SUBSCRIPTION_INACTIVE |
| team | none | verify | true | true | null |
| team | none | enforce | false | false | SUBSCRIPTION_INACTIVE |
| team | none | enforce | true | true | null |
| team | active | verify | false | true | null |
| team | active | verify | true | true | null |
| team | active | enforce | false | true | null |
| team | active | enforce | true | true | null |
| team | inactive | verify | false | false | SUBSCRIPTION_INACTIVE |
| team | inactive | verify | true | true | null |
| team | inactive | enforce | false | false | SUBSCRIPTION_INACTIVE |
| team | inactive | enforce | true | true | null |
| business | none | verify | false | false | SUBSCRIPTION_INACTIVE |
| business | none | verify | true | true | null |
| business | none | enforce | false | false | SUBSCRIPTION_INACTIVE |
| business | none | enforce | true | true | null |
| business | active | verify | false | true | null |
| business | active | verify | true | true | null |
| business | active | enforce | false | true | null |
| business | active | enforce | true | true | null |
| business | inactive | verify | false | false | SUBSCRIPTION_INACTIVE |
| business | inactive | verify | true | true | null |
| business | inactive | enforce | false | false | SUBSCRIPTION_INACTIVE |
| business | inactive | enforce | true | true | null |
| enterprise | none | verify | false | false | SUBSCRIPTION_INACTIVE |
| enterprise | none | verify | true | true | null |
| enterprise | none | enforce | false | false | SUBSCRIPTION_INACTIVE |
| enterprise | none | enforce | true | true | null |
| enterprise | active | verify | false | true | null |
| enterprise | active | verify | true | true | null |
| enterprise | active | enforce | false | true | null |
| enterprise | active | enforce | true | true | null |
| enterprise | inactive | verify | false | false | SUBSCRIPTION_INACTIVE |
| enterprise | inactive | verify | true | true | null |
| enterprise | inactive | enforce | false | false | SUBSCRIPTION_INACTIVE |
| enterprise | inactive | enforce | true | true | null |
