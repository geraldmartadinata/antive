from datetime import date

from .models import Balance, Bill, Budget, Entry, Goal

TODAY = date(2027, 1, 11)
PAYDAY = date(2027, 1, 15)


def profiles() -> list[dict]:
    worker = Budget(
        today=TODAY, cadence="monthly", payday=PAYDAY, income=2700000, flexible_limit=950000,
        balance=Balance(amount=1700000, on=TODAY, included_today=["worker-lunch"]),
        bills=[Bill(id="kos", label="Uang kos", amount=800000, first_due=date(2027, 1, 14), repeat="monthly")],
        goal=Goal(balance=1800000, target=3000000, contribution=300000, first_due=date(2027, 1, 14)),
        entries=[
            Entry(id="worker-movie", label="Nonton dan makan", amount=125000, on=date(2027, 1, 9)),
            Entry(id="worker-lunch", label="Makan di luar", amount=125000, on=TODAY),
        ],
    )
    student = Budget(
        today=TODAY, cadence="weekly", payday=PAYDAY, income=350000, flexible_limit=300000,
        balance=Balance(amount=410000, on=TODAY),
        bills=[Bill(id="praktikum", label="Iuran praktikum", amount=125000, first_due=date(2027, 1, 13))],
        goal=Goal(label="Dana darurat", balance=160000, target=400000, contribution=40000, first_due=date(2027, 1, 14)),
        entries=[Entry(id="student-food", label="Makan siang", amount=40000, on=date(2027, 1, 9))],
    )
    return [
        {"id": "worker", "label": "Pekerja muda", "budget": worker, "saved": []},
        {"id": "student", "label": "Mahasiswa", "budget": student, "saved": []},
    ]
