import re
from datetime import date, timedelta
from decimal import Decimal

AMOUNTS = re.compile(
    r"(?<![\w.])(?P<rp>rp\.?\s*)?"
    r"(?P<number>\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[,.]\d+)?)"
    r"(?:\s*(?P<unit>ribu|juta|rb|jt|k)\b)?(?![\d.,])",
    re.I,
)
DURATION = re.compile(r"(?<![\d,.])(\d{1,3})\s*(?:bulan|bln)\b", re.I)
WANTS = re.compile(r"\b(mau|ingin|pengen|pengin|berencana|rencana|cek|boleh|sanggup|akan|worth it)\b", re.I)
PAST = re.compile(r"\b(tadi|kemarin|barusan|sudah|udah)\b", re.I)
FINANCING = re.compile(r"\b(cicil\w*|pay\s?later|angsuran)\b", re.I)
GROUPED = re.compile(r"\d{1,3}(?:\.\d{3})+(?:,\d+)?")


def read_amount(number: str, unit: str) -> int | None:
    if GROUPED.fullmatch(number):
        number = number.replace(".", "")
    value = Decimal(number.replace(",", "."))
    if unit in {"rb", "ribu", "k"}:
        value *= 1000
    elif unit in {"jt", "juta"}:
        value *= 1000000
    if value != value.to_integral_value() or not 0 <= value <= 10**12:
        return None
    return int(value)


def preview(text: str, today: date) -> dict:
    duration = DURATION.search(text)
    months = int(duration[1]) if duration and 1 <= int(duration[1]) <= 60 else None
    amounts = []
    payment = None
    upfront = None
    financing = bool(FINANCING.search(text) or duration)
    for match in AMOUNTS.finditer(text):
        if duration and duration.start(1) <= match.start("number") < duration.end(1):
            continue
        number, unit = match["number"], (match["unit"] or "").lower()
        before, after = text[:match.start()], text[match.end():]
        if re.match(r"\s*%", after):
            continue
        value = read_amount(number, unit)
        explicitly_upfront = bool(re.search(r"\b(?:total biaya awal|biaya awal total)\s*[:=]?\s*$", before, re.I))
        if value is None or (not match["rp"] and not unit and value < 1000 and not explicitly_upfront):
            continue
        if explicitly_upfront:
            upfront = value
        elif value and financing and (
            re.search(r"\b(?:cicilan|angsuran)\s*[:=]?\s*$", before, re.I)
            or re.match(r"\s*(?:/\s*(?:bln|bulan)|per\s+(?:bln|bulan)|[x×]\s*\d)", after, re.I)
        ):
            payment = value
        elif not re.search(r"\b(?:dp|uang muka|admin|ongkir)\s*[:=]?\s*$", before, re.I) and value:
            amounts.append((value, match.start()))

    wants = bool(WANTS.search(text))
    past = bool(PAST.search(text))
    intent = None if wants and past else "purchase" if wants or financing else "expense"
    start_of_terms = min((position for _, position in amounts), default=len(text))
    description = text[:start_of_terms]
    description = re.sub(
        r"^(?:(?:aku|saya|gue|gw|tadi|kemarin|barusan|hari ini|mau|ingin|pengen|pengin|"
        r"rencana|cek|boleh|bisa|sanggup|sudah|udah|habis|beli|bayar)\s+)+",
        "", description, flags=re.I,
    )
    description = re.split(r"\b(?:cicilan|cicil|angsuran|seharga|harga)\b", description, maxsplit=1, flags=re.I)[0]
    description = description.strip(" \t,.:?!")
    item = (description[:1].upper() + description[1:])[:100]
    category = "essential" if re.search(r"\b(kos|listrik|obat|sewa|transport|ongkos)\b", text, re.I) else "flexible"
    return {
        "intent": intent,
        "item": item,
        "price": amounts[0][0] if len(amounts) == 1 else None,
        "on": today - timedelta(days=1) if re.search(r"\bkemarin\b", text, re.I) else today,
        "bucket": category,
        "urgent": bool(re.search(r"\b(?:mendesak|butuh segera|harus hari ini)\b", text, re.I)),
        "pressure": bool(re.search(r"\b(?:fomo|flash sale|ikut teman|gengsi|promo)\b", text, re.I)),
        "installment": (
            {"payment": payment, "months": months, "first_due": None, "upfront": upfront}
            if financing else None
        ),
    }
