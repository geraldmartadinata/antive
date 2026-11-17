# Purchase impulsivity experiment

XGBoost is a candidate for detecting impulsivity at the purchase level. Its output could help choose when to offer a reflection prompt. The experiment is planned and needs a labeled dataset. The PKM-AI proposal used debt-to-income to derive financial-risk labels for a public shopping dataset. The purchase-impulsivity study needs labels for how individual purchases were decided.

1. Define the target with purchase-specific evidence such as whether the person had planned the purchase and how quickly they decided. Collect the target independently of the signals used as model inputs.
2. Decide what can be observed before a purchase check. Candidate inputs include the urgency and promotion-pressure signals already recognized by the parser. Affordability is a separate budget outcome, and using it as a label would teach the model to reproduce the budget rules.
3. Compare XGBoost with a simple baseline on held-out examples. If participants contribute multiple purchases, keep each person's examples in the same split. Report precision and recall alongside the number and mix of examples so the team can judge when a flag would be helpful.

The proposal also identified SHAP for inspecting feature contributions. Try it after a model can be evaluated against a baseline.

Keep the experiment separate from the demo's budget decisions and template guidance. The training script, dataset, and trained model are pending.
