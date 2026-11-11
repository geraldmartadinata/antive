import argparse
import json
from pathlib import Path
import re
from time import perf_counter
from urllib.request import Request, urlopen

from antive.demo import profiles
from antive.engine import compare
from antive.guidance import explanation, retrieve
from antive.models import Offer

CASES = [
    ("Barang pengganti mendesak", Offer(item="HP untuk kerja", price=1500000, urgent=True), "urgent"),
    ("Tekanan promo", Offer(item="Sepatu flash sale", price=275000, pressure=True), "pressure"),
    ("Di atas anggaran", Offer(item="HP bekas", price=1500000), "over_budget"),
    ("Belanja yang muat", Offer(item="Buku", price=45000), "reflection"),
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
    budget = profiles()[0]["budget"]
    rows = []
    for name, offer, expected in CASES:
        calculated = compare(budget, offer)
        baseline = explanation(offer, calculated)
        source = retrieve(baseline["context"])
        start = perf_counter()
        generated = generate(args.endpoint, args.model, name, source["evidence"])
        rows.append({
            "case": name, "item": offer.item, "expected_context": expected, "context": baseline["context"],
            "source": baseline["source"], "price_limit": calculated["report"]["price_limit"],
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
