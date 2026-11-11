from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

Money = Annotated[int, Field(ge=0, le=10**12, strict=True)]
PositiveMoney = Annotated[int, Field(gt=0, le=10**12, strict=True)]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Cadence = Literal["weekly", "monthly"]
Bucket = Literal["flexible", "essential"]


class Balance(BaseModel):
    amount: Money
    on: date
    included_today: list[str] = Field(default_factory=list, max_length=2000)


class Entry(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    label: Label
    amount: PositiveMoney
    on: date
    kind: Literal["expense", "income", "bill", "saving"] = "expense"
    bucket: Bucket = "flexible"
    event_id: str | None = Field(default=None, max_length=140)


class Bill(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    label: Label
    amount: PositiveMoney
    first_due: date
    repeat: Literal["once", "weekly", "monthly"] = "once"
    count: int | None = Field(default=None, ge=1, le=60)


class Goal(BaseModel):
    label: Label = "Dana darurat"
    balance: Money
    target: PositiveMoney
    contribution: Money
    first_due: date


class Budget(BaseModel):
    today: date
    cadence: Cadence
    payday: date
    income: Money
    flexible_limit: Money
    balance: Balance
    bills: list[Bill] = Field(default_factory=list, max_length=60)
    goal: Goal
    entries: list[Entry] = Field(default_factory=list, max_length=2000)

    @model_validator(mode="after")
    def check_dates_and_ids(self):
        if not 2000 <= self.today.year <= 2090:
            raise ValueError("Tanggal simulasi harus berada di antara 2000 dan 2090.")
        if self.balance.on > self.today or any(entry.on > self.today for entry in self.entries):
            raise ValueError("Saldo dan catatan harus bertanggal hari ini atau sebelumnya.")
        if len({entry.id for entry in self.entries}) != len(self.entries):
            raise ValueError("ID catatan harus unik.")
        if len({bill.id for bill in self.bills}) != len(self.bills):
            raise ValueError("ID tagihan harus unik.")
        event_ids = [entry.event_id for entry in self.entries if entry.event_id]
        if len(set(event_ids)) != len(event_ids):
            raise ValueError("Pembayaran terjadwal sudah dicatat.")
        return self


class Installment(BaseModel):
    payment: PositiveMoney | None = None
    months: int | None = Field(default=None, ge=1, le=60, strict=True)
    first_due: date | None = None
    upfront: Money | None = None


class Offer(BaseModel):
    item: Label
    price: PositiveMoney | None = None
    bucket: Bucket = "flexible"
    urgent: bool = False
    pressure: bool = False
    redirect_savings: bool = False
    installment: Installment | None = None


class PreviewRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500, strip_whitespace=True)
    today: date


class CompareRequest(BaseModel):
    budget: Budget
    offer: Offer
