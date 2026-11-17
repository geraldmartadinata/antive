import argparse
from dataclasses import dataclass
import json
from pathlib import Path
import re
from time import perf_counter
from urllib.request import Request, urlopen

from antive.guidance import explanation, retrieve

WORKER_PRICE_LIMIT = 600_000


@dataclass(frozen=True)
class Case:
    name: str
    item: str
    expected_context: str
    urgent: bool = False
    pressure: bool = False
    cash_purchase_gap: bool = False


CASES = [
    Case("Barang pengganti mendesak", "HP untuk kerja", "urgent", urgent=True, cash_purchase_gap=True),
    Case("Tekanan promo", "Sepatu flash sale", "pressure", pressure=True),
    Case("Di atas anggaran", "HP bekas", "over_budget", cash_purchase_gap=True),
    Case("Belanja yang muat", "Buku", "reflection"),
]


def generate(endpoint, model, context, evidence):
    messages = [
        {
            "role": "system",
            "content": (
                "Tulis satu pertanyaan refleksi singkat dalam bahasa Indonesia yang alami. "
                "Gunakan temuan dari sumber untuk membantu keputusan pembelian. "
                "Hanya tulis pertanyaannya. Hindari angka, diagnosis, kutipan, dan penilaian orang."
            ),
        },
        {"role": "user", "content": f"Situasi: {context}. Bukti: {evidence}"},
    ]
    payload = json.dumps({
        "model": model, "messages": messages, "max_tokens": 80, "temperature": 0, "seed": 17,
    }).encode()
    request = Request(
        endpoint.rstrip("/") + "/v1/chat/completions", data=payload,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urlopen(request, timeout=90) as response:
        return json.load(response)["choices"][0]["message"]["content"].strip()


def main():
    parser = argparse.ArgumentParser(description="Compare Antive's prompts with a local retrieval-conditioned model.")
    parser.add_argument("--endpoint", default="http://127.0.0.1:8092")
    parser.add_argument("--model", default="qwen2.5-0.5b-instruct-q4_k_m")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    rows = []
    for case in CASES:
        comparison = {"options": [{"purchase_gap": case.cash_purchase_gap}]}
        baseline = explanation(case, comparison)
        source = retrieve(baseline["context"])
        start = perf_counter()
        generated = generate(args.endpoint, args.model, case.name, source["evidence"])
        rows.append({
            "case": case.name, "item": case.item, "expected_context": case.expected_context,
            "context": baseline["context"], "source": baseline["source"], "price_limit": WORKER_PRICE_LIMIT,
            "handwritten": baseline["text"], "generated": generated,
            "generated_is_single_question_without_numbers": (
                generated.endswith("?") and generated.count("?") == 1 and not re.search(r"\d", generated)
            ),
            "generation_ms": round((perf_counter() - start) * 1000),
        })
    args.output.write_text(json.dumps({"model": args.model, "cases": rows}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(rows)} comparisons to {args.output}")


if __name__ == "__main__":
    main()
