from calendar import monthrange
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

from .models import Budget, Entry, Offer

DAY = timedelta(days=1)


@dataclass(frozen=True)
class Event:
    on: date
    kind: str
    id: str
    label: str
    amount: int


def shift(anchor: date, cadence: str, steps: int) -> date:
    if cadence == "weekly":
        return anchor + timedelta(weeks=steps)
    year, month = divmod(anchor.year * 12 + anchor.month - 1 + steps, 12)
    month += 1
    return date(year, month, min(anchor.day, monthrange(year, month)[1]))


def period(anchor: date, cadence: str, day: date) -> tuple[date, date]:
    if cadence == "weekly":
        index = (day - anchor).days // 7
    else:
        index = (day.year - anchor.year) * 12 + day.month - anchor.month
        if shift(anchor, cadence, index) > day:
            index -= 1
    return shift(anchor, cadence, index), shift(anchor, cadence, index + 1)


def due_dates(first: date, repeat: str, end: date, count: int | None = None, start: date | None = None):
    if repeat == "once":
        if first <= end and (start is None or first >= start):
            yield first
        return
    index = 0
    if start and start > first:
        if repeat == "weekly":
            index = (start - first).days // 7
        else:
            index = (start.year - first.year) * 12 + start.month - first.month
        if shift(first, repeat, index) < start:
            index += 1
    while count is None or index < count:
        day = shift(first, repeat, index)
        if day > end:
            break
        yield day
        index += 1


def cash_balance(budget: Budget) -> int:
    snapshot = budget.balance
    covered = set(snapshot.included_today)
    return snapshot.amount + sum(
        entry.amount if entry.kind == "income" else -entry.amount
        for entry in budget.entries
        if entry.on > snapshot.on or (entry.on == snapshot.on and entry.id not in covered)
    )


def goal_balance(budget: Budget) -> int:
    return budget.goal.balance + sum(entry.amount for entry in budget.entries if entry.kind == "saving")


def flexible_spent(budget: Budget, start: date) -> int:
    return sum(
        entry.amount for entry in budget.entries
        if entry.on >= start and entry.kind == "expense" and entry.bucket == "flexible"
    )


def pending_bills(budget: Budget, end: date) -> list[Event]:
    paid = {entry.event_id for entry in budget.entries}
    events = []
    for bill in budget.bills:
        # The schedule starts with the first unpaid obligation the user entered.
        for day in due_dates(bill.first_due, bill.repeat, end, bill.count):
            event_id = f"bill:{bill.id}:{day}"
            if event_id not in paid:
                events.append(Event(day, "bill", event_id, bill.label, bill.amount))
    return sorted(events, key=lambda event: (event.on, event.id))


def savings_events(budget: Budget, end: date) -> list[Event]:
    goal = budget.goal
    if not goal.contribution or goal_balance(budget) >= goal.target:
        return []
    paid = {entry.event_id for entry in budget.entries}
    start, _ = period(budget.payday, budget.cadence, budget.today)
    return [
        Event(day, "saving", f"goal:{day}", goal.label, goal.contribution)
        for day in due_dates(goal.first_due, budget.cadence, end, start=start)
        if f"goal:{day}" not in paid
    ]


def income_events(budget: Budget, end: date) -> list[Event]:
    _, first = period(budget.payday, budget.cadence, budget.today)
    if not budget.income:
        return []
    label = "Uang saku" if budget.cadence == "weekly" else "Gaji"
    return [
        Event(day, "income", f"pay:{day}", label, budget.income)
        for day in due_dates(first, budget.cadence, end)
    ]


def _goal_reserve(events: list[Event], remaining: int) -> int:
    return min(max(0, remaining), sum(event.amount for event in events))


def _gap(event: Event, amount: int) -> dict:
    return {"label": event.label, "on": event.on, "short": amount}


def _forecast(budget: Budget, payments: list[Event] | None = None, offer: Offer | None = None) -> dict:
    end = shift(budget.today, "monthly", 72)
    start, _ = period(budget.payday, budget.cadence, budget.today)
    cash = cash_balance(budget)
    saved = goal_balance(budget)
    target = budget.goal.target
    goal_date = budget.today if saved >= target else None
    spent = defaultdict(int, {start: flexible_spent(budget, start)})
    bills = pending_bills(budget, end)
    savings = savings_events(budget, end)
    bills_by_cycle = defaultdict(list)
    savings_by_cycle = defaultdict(list)
    for event in bills:
        event_start, _ = period(budget.payday, budget.cadence, max(budget.today, event.on))
        bills_by_cycle[event_start].append(event)
    for event in savings:
        event_start, _ = period(budget.payday, budget.cadence, max(budget.today, event.on))
        savings_by_cycle[event_start].append(event)
    priority = {"income": 0, "bill": 1, "purchase": 2, "saving": 3}
    timeline = sorted(
        [*income_events(budget, end), *bills, *savings, *(payments or [])],
        key=lambda event: (max(budget.today, event.on), priority[event.kind], event.on, event.id),
    )
    bill_gap = goal_gap = purchase_gap = None
    skipped_contributions = {}
    redirected = 0
    for event in timeline:
        day = max(budget.today, event.on)
        cycle, _ = period(budget.payday, budget.cadence, day)
        if event.kind == "income":
            cash += event.amount
        elif event.kind == "bill":
            if cash < event.amount:
                if bill_gap is None:
                    bill_gap = _gap(event, event.amount - max(0, cash))
            cash -= event.amount
        elif event.kind == "purchase":
            remaining_bills = sum(bill.amount for bill in bills_by_cycle[cycle] if bill.on > day)
            future_savings = [
                saving for saving in savings_by_cycle[cycle] if max(budget.today, saving.on) >= day
            ]
            reserves = min(
                max(0, target - saved),
                sum(saving.amount - skipped_contributions.get(saving.id, 0) for saving in future_savings),
            )
            flexible = max(0, budget.flexible_limit - spent[cycle])
            usable_cash = max(0, cash - remaining_bills - reserves)
            room = min(usable_cash, flexible) if offer.bucket == "flexible" else usable_cash
            gap = max(0, event.amount - room)
            moved_for_payment = 0
            if gap and offer.redirect_savings:
                # Reallocating a planned deposit cannot cover a bill or create cash.
                transferable = min(gap, reserves, max(0, cash - remaining_bills - room))
                for saving in future_savings:
                    if not transferable:
                        break
                    already_skipped = skipped_contributions.get(saving.id, 0)
                    moved = min(transferable, saving.amount - already_skipped)
                    skipped_contributions[saving.id] = already_skipped + moved
                    moved_for_payment += moved
                    redirected += moved
                    gap -= moved
                    transferable -= moved
            if gap and purchase_gap is None:
                purchase_gap = _gap(event, gap)
            cash -= event.amount
            if offer.bucket == "flexible":
                spent[cycle] += event.amount - moved_for_payment
        elif saved < target:
            intended = min(event.amount - skipped_contributions.get(event.id, 0), target - saved)
            remaining_bills = sum(bill.amount for bill in bills_by_cycle[cycle] if bill.on > day)
            actual = min(intended, max(0, cash - remaining_bills))
            if actual < intended and goal_gap is None:
                goal_gap = _gap(event, intended - actual)
            cash -= actual
            saved += actual
            if saved >= target and goal_date is None:
                goal_date = day
    return {
        "goal_date": goal_date,
        "bill_gap": bill_gap,
        "goal_gap": goal_gap,
        "purchase_gap": purchase_gap,
        "redirected": redirected,
    }


def report(budget: Budget) -> dict:
    start, payday = period(budget.payday, budget.cadence, budget.today)
    cash = cash_balance(budget)
    spent = flexible_spent(budget, start)
    remaining = max(0, budget.flexible_limit - spent)
    bills = pending_bills(budget, payday - DAY)
    reserve = sum(event.amount for event in bills)
    saved = goal_balance(budget)
    planned = _goal_reserve(savings_events(budget, payday - DAY), budget.goal.target - saved)
    return {
        "today": budget.today,
        "cycle_start": start,
        "payday": payday,
        "cash": cash,
        "balance_updated": max([budget.balance.on, *(entry.on for entry in budget.entries)]),
        "price_limit": max(0, min(remaining, cash - reserve - planned)),
        "flexible_limit": budget.flexible_limit,
        "flexible_spent": spent,
        "flexible_remaining": remaining,
        "bill_reserve": reserve,
        "saving_reserve": planned,
        "bills": [{"id": event.id, "label": event.label, "amount": event.amount, "on": event.on} for event in bills],
        "goal": {"balance": saved, "target": budget.goal.target, "date": _forecast(budget)["goal_date"]},
    }


def missing_installment(budget: Budget, offer: Offer) -> list[str]:
    terms = offer.installment
    if terms is None:
        return ["payment", "months", "first_due", "upfront"]
    missing = [field for field in ("payment", "months", "first_due", "upfront") if getattr(terms, field) is None]
    if terms.first_due and not budget.today <= terms.first_due <= shift(budget.today, "monthly", 12):
        missing.append("first_due")
    return missing


def compare(budget: Budget, offer: Offer) -> dict:
    summary = report(budget)
    baseline = _forecast(budget)

    def scenario(mode: str, payments: list[Event]) -> dict:
        forecast = _forecast(budget, payments, offer)
        goal_date = forecast["goal_date"]
        baseline_date = baseline["goal_date"]
        changed = baseline_date != goal_date
        goal_status = "planned"
        if changed and not offer.redirect_savings:
            goal_status, goal_date = "review", None
        elif changed:
            goal_status = "adjusted"
        return {
            "mode": mode,
            "total": sum(event.amount for event in payments),
            "bill_gap": forecast["bill_gap"],
            "goal_gap": forecast["goal_gap"],
            "purchase_gap": forecast["purchase_gap"],
            "goal_date": goal_date,
            "goal_status": goal_status,
            "redirected": forecast["redirected"],
        }

    options = []
    if offer.price:
        options.append(scenario("today", [Event(budget.today, "purchase", "cash", offer.item, offer.price)]))
        options.append(scenario("payday", [Event(summary["payday"], "purchase", "cash", offer.item, offer.price)]))
    else:
        options.extend({"mode": mode, "missing": ["price"]} for mode in ("today", "payday"))
    missing = missing_installment(budget, offer)
    if missing:
        options.append({"mode": "installment", "missing": missing})
    else:
        terms = offer.installment
        payments = [
            Event(shift(terms.first_due, "monthly", month), "purchase", f"term:{month}", offer.item, terms.payment)
            for month in range(terms.months)
        ]
        if terms.upfront:
            payments.append(Event(budget.today, "purchase", "upfront", offer.item, terms.upfront))
        options.append(scenario("installment", payments))
    return {"report": summary, "options": options}


def advance(budget: Budget) -> Budget:
    _, payday = period(budget.payday, budget.cadence, budget.today)
    cash = cash_balance(budget)
    saved = goal_balance(budget)
    entries = list(budget.entries)
    bills = pending_bills(budget, payday)
    priorities = {"income": 0, "bill": 1, "saving": 2}
    events = sorted(
        [*income_events(budget, payday), *bills, *savings_events(budget, payday)],
        key=lambda event: (max(budget.today, event.on), priorities[event.kind], event.on),
    )
    for event in events:
        amount = event.amount
        if event.kind == "saving":
            pending = {entry.event_id for entry in entries}
            unpaid = sum(
                bill.amount for bill in bills
                if bill.id not in pending and (bill.on < payday or event.on == payday)
            )
            amount = min(amount, budget.goal.target - saved)
            if amount > cash - unpaid:
                continue
        if amount <= 0 or (event.kind != "income" and amount > cash):
            continue
        entries.append(Entry(
            id=event.id, label=event.label, amount=amount, on=max(budget.today, event.on),
            kind=event.kind, bucket="essential", event_id=event.id,
        ))
        if event.kind == "income":
            cash += amount
        else:
            cash -= amount
        if event.kind == "saving":
            saved += amount
    return budget.model_copy(update={"today": payday, "entries": entries})
