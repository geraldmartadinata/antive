# Local RAG comparison

The experiment used four fictional purchases with the same salary profile. The prototype's budget calculation returned a spending limit of Rp600,000 for that profile. The retrieval step ranked three short research notes by keyword overlap with the purchase context. A local Qwen2.5 0.5B model, quantized to Q4_K_M and served by llama.cpp, received the retrieved evidence and a description of the situation. Each comparison records the same budget limit and retrieved citation for both responses.

| Case | Source retrieved | Hand-written response asks about | Model output in this run |
| --- | --- | --- | --- |
| Urgent replacement | Opportunity Cost Neglect | Comparing replacement prices and checking affected bills | Asks about finding a source to choose a suitable replacement |
| Promotion pressure | Dark patterns in online shopping | Whether the item would still appeal after the promotion | Asks broadly for recommendations about dealing with promotion pressure |
| Over budget | Opportunity Cost Neglect | Which other expense would move | Asks about finding a source for a more affordable product |
| Fits the budget | Impulse Buying: Design Practices and Consumer Needs | When the item will be used and whether to revisit it | Asks broadly about reducing impulse buying |

All four cases retrieved the expected topic and produced a single question without numeric claims. Generation took 2.6 to 6.7 seconds on this machine. The hand-written responses gave the user a more specific decision to consider in these cases, so the prototype used them. This is a small qualitative comparison. The proposed participant pilot measures whether users understand the tradeoff and can reopen a decision efficiently.

[Raw results](rag-results.json)

The PKM-AI proposal described embedding search over psychology literature and OJK materials. The current experiment ranks three research notes by keyword overlap. A larger corpus and vector retrieval remain research options.

## Reproduce

Start a local llama.cpp server with [Qwen2.5 0.5B Instruct GGUF](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF). The evaluator uses the original fictional cases and replays the budget information needed by the study. Run from the repository root:

~~~sh
llama-server -m qwen2.5-0.5b-instruct-q4_k_m.gguf --host 127.0.0.1 --port 8092
python -m research.evaluate_rag --output research/rag-rerun.json
~~~

See the [XGBoost experiment plan](xgboost/README.md) for the separate purchase-impulsivity study.
