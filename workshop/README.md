# MIA Workshop

The Workshop is the passive engineering observability layer for MIA.

It does not build product features, analyze business logic, or make autonomous decisions.
It observes development activity, stores structured evidence, and produces session reports that future Council modules can consume.

## Principles

- Observe first.
- Remember second.
- Reason later.
- Thinking is valuable.
- Shipping is mandatory.

## Architecture

- Observer: captures development signals from browser, runtime, build, tests, git, and APIs.
- Collector: normalizes, deduplicates, and compresses events.
- Recorder: persists events append-only in JSONL.
- Session lifecycle: creates and closes development sessions.
- Session report: produces structured evidence at the end of a session.

## Current Sprint

Sprint 0 focuses on the passive foundation:

- structured event model
- configuration system
- session lifecycle
- event collector
- JSONL recorder
- session report generator

No AI, prompts, or autonomous recommendations are included in this phase.
