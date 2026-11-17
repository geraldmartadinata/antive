# Working on Antive

Read [the PRD](docs/PRD.md) for product scope and [the research notes](research/rag.md) before changing retrieval or prompts. The team members building the frontend and backend own those parts of the project. Coordinate integration with them once their first implementation is ready.

- Keep currency, due dates, and affordability tied to deterministic inputs. Use retrieval and templates to explain the decision in Indonesian. Preserve source citations and leave ambiguous parser fields for confirmation.
- Keep the XGBoost work in [the research plan](research/xgboost/README.md) until independent purchase-level labels are available. An affordability shortfall is a budget outcome. Impulsivity requires its own evidence.
- Use fictional examples in this repo. Store participant responses, real transactions, credentials, and model artifacts outside Git.
- Run `python -m unittest discover -s tests -v` for parser changes. For RAG changes, rerun the four fictional cases, retain the original results for comparison, and record the model and settings used.
