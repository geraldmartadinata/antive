# Antive

Antive helps Indonesian students on allowances and young salaried workers decide whether a purchase fits their budget and whether it is worth making now. This repository contains the language and ML research for the project.

| Path | What's there |
| --- | --- |
| `antive/parser.py` | Rules for extracting transaction details from Indonesian text, including amounts such as `25rb` and `1,5jt`. |
| `antive/guidance.py` | Keyword retrieval over three research notes and Indonesian reflection prompts with citations. |
| [`research/rag.md`](research/rag.md) | Local Qwen experiment, four fictional cases, recorded outputs, and reproduction steps. |
| [`research/xgboost/`](research/xgboost/README.md) | Plan for an XGBoost experiment once independently labeled purchase examples are available. |
| [`research/pilot.md`](research/pilot.md) | Proposed Antive and Gemini tasks for a student and young-worker pilot. |
| [`docs/PRD.md`](docs/PRD.md) | Product scope, January demo, and research questions. |
| [`AGENTS.md`](AGENTS.md) | Scope and checks for contributors. |

The parser and cited templates run with the Python standard library. From the repository root, use Python 3.12 or newer:

~~~sh
python -m unittest discover -s tests -v
python -m research.evaluate_rag --help
~~~

The budget comparison supplies the affordability facts used by guidance. The RAG evaluation replays those inputs from the original fictional cases, so it can run independently with a local model.
