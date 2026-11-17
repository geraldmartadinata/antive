from collections import Counter

SOURCES = (
    {
        "id": "alternatives",
        "title": "Opportunity Cost Neglect",
        "url": "https://doi.org/10.1086/599764",
        "tags": "tagihan anggaran selisih alternatif kebutuhan pengganti harga",
        "evidence": "Eksperimen Frederick dan rekan menunjukkan bahwa mengingat pilihan lain yang dapat dibiayai memengaruhi keputusan pembelian.",
        "prompt": "Kalau barang ini dibeli, pengeluaran mana yang perlu kamu geser?",
    },
    {
        "id": "pressure",
        "title": "Dark patterns in online shopping",
        "url": "https://doi.org/10.1017/bpp.2022.11",
        "tags": "promo tekanan fomo diskon terburu flash sale",
        "evidence": "Sin dan rekan menguji refleksi dan penundaan dalam simulasi belanja dengan tekanan promosi. Hasil bergantung pada bentuk tekanannya.",
        "prompt": "Kalau promonya selesai, apakah barang ini masih ingin kamu beli?",
    },
    {
        "id": "reflection",
        "title": "Impulse Buying: Design Practices and Consumer Needs",
        "url": "https://doi.org/10.1145/3290605.3300472",
        "tags": "refleksi jeda tunggu tujuan belanja penting rencana",
        "evidence": "Dalam survei Moser dan rekan, sebagian peserta menyebut refleksi, batas belanja, dan penundaan sebagai cara mengendalikan pembelian spontan.",
        "prompt": "Kapan kamu akan memakai barang ini? Simpan rencananya jika kamu ingin mengecek lagi setelah pemasukan berikutnya.",
    },
)

QUERIES = {
    "urgent": "kebutuhan pengganti harga alternatif",
    "pressure": "promo tekanan fomo diskon",
    "over_budget": "anggaran selisih tagihan alternatif",
    "reflection": "refleksi jeda tunggu rencana",
}


def retrieve(context: str) -> dict:
    query = Counter(QUERIES[context].split())
    return max(SOURCES, key=lambda source: sum((query & Counter(source["tags"].split())).values()))


def explanation(offer, comparison: dict) -> dict:
    cash_option = comparison["options"][0]
    context = (
        "urgent" if offer.urgent
        else "pressure" if offer.pressure
        else "over_budget" if cash_option.get("purchase_gap")
        else "reflection"
    )
    source = retrieve(context)
    message = source["prompt"]
    if context == "urgent":
        message = "Kalau barangnya dibutuhkan segera, coba bandingkan harga pengganti dan lihat tagihan yang akan terdampak."
    return {"text": message, "context": context, "source": {key: source[key] for key in ("title", "url")}}
