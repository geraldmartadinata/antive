# Antive

Antive helps students and young workers check a purchase against upcoming bills, discretionary money, and one savings goal. The demo starts on 11 January 2027 with editable fictional profiles.

1. Type “Tadi makan 25rb” or “Mau beli HP bekas 1,5jt” and check the editable preview.
2. Compare the purchase today, on the next payday, or with entered installment terms. Save the check to revisit it.
3. Simulate payday and log another expense. Reopen the saved check to see the current budget.
4. Use **Riwayat** to edit expenses and **Tujuan** to update the savings target.

Browser storage keeps the two fictional profiles and their saved checks on the current browser. Use **Reset profil contoh** to start the active profile over. The hosted demo uses cited Indonesian templates and needs no model credentials.

## Run locally

Install Python 3.12 or later and Node.js 22.12 or later. From the Antive folder:

~~~sh
python -m venv .venv
~~~

Activate with `.venv\Scripts\Activate.ps1` on PowerShell or `source .venv/bin/activate` on macOS or Linux. Then run:

~~~sh
python -m pip install -r requirements.txt
npm ci
npm run build
python -m uvicorn app:app --host 127.0.0.1 --port 8000
~~~

Open <http://127.0.0.1:8000>. For frontend development, run `npm run dev` in a second terminal while Uvicorn is running. Vite forwards `/api` to port 8000.

## Budget rules

- The spending limit is the smaller of the remaining discretionary budget and cash left after known bills and planned savings due before the next income. Existing goal savings are held separately from spendable cash.
- A balance correction reconciles cash through that date. Later confirmed entries change the balance. Earlier entries still count toward the spending report for their cycle.
- An installment quote needs the monthly payment, term, first due date, and total upfront fees or down payment. The forecast uses the recorded income, bills, and contributions. Extra future spending may change it.
- Simulating payday posts the modeled income and affordable scheduled payments. Unpaid bills remain due. A savings tradeoff is hypothetical and requires the user to enable it in the comparison.

The FastAPI operations are `GET /api/demo`, `POST /api/preview`, `POST /api/report`, `POST /api/compare`, and `POST /api/advance`. The JSON schemas are available at `/docs` on the local server.

## Verify and deploy

~~~sh
python -m unittest discover -s tests -v
npm run build
~~~

Vercel detects `app.py` as a FastAPI app. The build command in `vercel.json` builds the React assets before deployment. Run `npx vercel@latest deploy --temporary -y` from the Antive folder for a claimable test link, or `npx vercel@latest deploy` from an authenticated account. [FastAPI on Vercel](https://vercel.com/docs/frameworks/backend/fastapi) · [Temporary deployments](https://vercel.com/docs/deployments/deploy-without-logging-in)

The [RAG experiment](research/rag.md) records the model and template comparison. The [pilot protocol](research/pilot.md) provides matched Antive and Gemini tasks and a score sheet for student and worker sessions.
