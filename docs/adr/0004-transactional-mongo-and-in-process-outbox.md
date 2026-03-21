# ADR 0004: Transactional Mongo Runtime and In-Process Outbox

Status: Accepted  
Date: 2026-03-21

## Context

The original integration pass left several core CJ Laundry business mutations vulnerable to partial commits:

- order confirmation could create an order and partially miss ledger or notification side effects
- done/void flows could update order state without all related writes succeeding together
- notification delivery was processed inline in the request path instead of through a durable outbox model

The PRD explicitly requires:

- atomic business writes for order, ledger, and related state
- outbox-like semantics for WhatsApp notifications
- separate tracking for receipt render state and message delivery state

MongoDB multi-document transactions require a replica set, even for a single-node deployment.

## Decision

The repo now standardizes on:

1. single-node MongoDB replica-set mode for local and hosted Docker Compose runtimes
2. transaction-backed backend mutations for create-customer, confirm-order, mark-done, void-order, and related side effects
3. an in-process outbox worker inside the monolith for v1 notification processing

Notification processing now follows this model:

- request handlers persist business state and queued notification documents
- the outbox worker polls queued notifications after commit
- order-confirmed notifications treat receipt render and delivery as separate states
- resend requeues the notification instead of performing inline delivery in the request handler

## Rationale

- This is the smallest runtime change that makes the existing monolith satisfy PRD atomicity requirements.
- A single-node replica set keeps operational complexity low while still enabling transactions.
- An in-process outbox worker preserves monolith simplicity for v1 and avoids introducing a separate queue system before it is needed.
- Persisting queued notification records before delivery makes retry, manual resolution, and failure visibility deterministic.

## Consequences

Positive:

- core business writes now have a clear path to atomicity
- notification failures no longer require rolling back successful business transactions
- admin outbox can represent render failure, delivery failure, resend, and manual resolution consistently
- tests can validate transaction behavior and durable outbox state transitions

Tradeoffs:

- MongoDB Compose setup is slightly more complex because replica-set initialization is required
- the outbox worker is tied to monolith process lifetime and is not horizontally distributed
- local and hosted smoke/runtime assumptions must keep replica-set health in mind

## Follow-Up

- When a real WhatsApp adapter is introduced, it should plug into the existing outbox worker flow instead of reintroducing inline delivery from request handlers.
- If the runtime later grows beyond a single monolith instance, the outbox worker should be revisited with a distributed queue or lease/claim model.
