# Antive product requirements

## Audience and problem

Antive is for Indonesian students who manage an allowance and young salaried workers who budget around payday. A purchase can fit the current balance and still crowd out rent, a scheduled savings contribution, or spending needed until the next income. Antive helps people see the tradeoff before buying and keep a purchase decision they can revisit.

## January 2027 demo

- Check a planned purchase from informal Indonesian text. Let the user correct the parsed item, price, or terms before using them.
- Show what the purchase would do to the budget if paid in cash now, deferred to the next payday, or paid in installments. An installment comparison needs the payment amount, number of months, first due date, and total upfront cost.
- Let the user save a check, log a confirmed expense, and track one savings goal. Reopening a saved check uses the current budget. Saving a check leaves recorded spending alone.
- Start with editable fictional profiles for a student and a young worker. Show the spending limit, affected bills, and effect on the savings goal so the user can explain the choice in their own words.

## AI and research

The parser is rules-based. It extracts prices, timing, installment clues, and signals such as urgency or promotion pressure. The guidance selects a research note by keyword overlap and uses its citation in a short reflection prompt. The prototype's spending limit and payment effects come from dated budget calculations.

The team compared the templates with a local Qwen2.5 0.5B model on four fictional purchases. The templates gave more specific prompts in those examples. They remain the baseline for the demo. See [the experimental setup and results](../research/rag.md).

XGBoost is a separate experiment for purchase-level impulsivity. The next dependency is an independent label definition and labeled examples. See [the ML plan](../research/xgboost/README.md).

## Evaluation and open decisions

The [pilot protocol](../research/pilot.md) compares Antive and Gemini on the same fictional budget and purchase tasks. Measure whether participants can identify the spending limit, explain effects on bills and savings, and reopen the decision after payday. This pilot tests task performance and understanding. A study of habit change would need separate measures.

Participant recruitment, collection and handling of labeled purchase data, and deployment decisions are open. Frontend and backend implementation belong to the teammates working on those parts.
