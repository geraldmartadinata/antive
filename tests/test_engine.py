import unittest
from datetime import date

from antive.demo import TODAY, profiles
from antive.engine import advance, compare, report, shift
from antive.guidance import explanation
from antive.models import Balance, Entry, Installment, Offer
from antive.parser import preview


class PreviewTests(unittest.TestCase):
    def test_indonesian_amounts(self):
        for text, expected in [
            ("Mau beli HP bekas 1,5jt", 1500000),
            ("Mau beli iPhone 13 bekas Rp1.500.000", 1500000),
            ("Mau beli HP bekas 1500000", 1500000),
            ("Tadi makan 25rb", 25000),
        ]:
            with self.subTest(text=text):
                self.assertEqual(preview(text, TODAY)["price"], expected)

    def test_duration_is_not_money(self):
        draft = preview("Mau beli HP bekas, cicilan 600k x 12 bulan", TODAY)
        self.assertIsNone(draft["price"])
        self.assertEqual(draft["installment"]["payment"], 600000)
        self.assertEqual(draft["installment"]["months"], 12)
        self.assertIsNone(draft["installment"]["upfront"])

    def test_unclear_price_is_left_unconfirmed(self):
        draft = preview("Mau beli HP antara 1,5jt atau 2jt", TODAY)
        self.assertIsNone(draft["price"])
        self.assertEqual(draft["intent"], "purchase")


class BudgetTests(unittest.TestCase):
    def setUp(self):
        self.worker = profiles()[0]["budget"]
        self.student = profiles()[1]["budget"]

    def test_seeds_reserve_upcoming_bills_and_savings(self):
        self.assertEqual(report(self.worker)["price_limit"], 600000)
        self.assertEqual(report(self.student)["price_limit"], 245000)

    def test_snapshot_does_not_double_count_expenses(self):
        entry = Entry(id="new", label="Makan", amount=25000, on=TODAY)
        revised = self.worker.model_copy(update={"entries": [*self.worker.entries, entry]})
        self.assertEqual(report(revised)["cash"], 1675000)
        reconciled = revised.model_copy(update={
            "balance": Balance(amount=1720000, on=TODAY, included_today=["worker-lunch", "new"]),
        })
        self.assertEqual(report(reconciled)["cash"], 1720000)
        self.assertEqual(report(reconciled)["price_limit"], 620000)

    def test_essential_purchase_still_shows_unfunded_bill(self):
        offer = Offer(item="HP untuk kerja", price=1500000, bucket="essential", urgent=True)
        result = compare(self.worker, offer)
        today = result["options"][0]
        self.assertEqual(today["bill_gap"]["label"], "Uang kos")
        self.assertEqual(today["bill_gap"]["short"], 600000)
        self.assertIsNone(today["goal_date"])
        self.assertEqual(explanation(offer, result)["context"], "urgent")

    def test_installment_total_requires_complete_terms(self):
        terms = Installment(payment=600000, months=12)
        offer = Offer(item="HP bekas", price=1500000, installment=terms)
        missing = compare(self.worker, offer)["options"][2]
        self.assertNotIn("total", missing)
        self.assertEqual(set(missing["missing"]), {"first_due", "upfront"})
        complete = offer.model_copy(update={"installment": terms.model_copy(update={
            "first_due": date(2027, 1, 25), "upfront": 100000,
        })})
        self.assertEqual(compare(self.worker, complete)["options"][2]["total"], 7300000)

    def test_savings_redirect_requires_opt_in(self):
        offer = Offer(item="HP", price=900000, bucket="essential")
        first = compare(self.worker, offer)["options"][0]
        self.assertIsNone(first["goal_date"])
        self.assertEqual(first["redirected"], 0)
        redirected = compare(self.worker, offer.model_copy(update={"redirect_savings": True}))["options"][0]
        self.assertEqual(redirected["redirected"], 300000)
        self.assertGreater(redirected["goal_date"], report(self.worker)["goal"]["date"])
        self.assertEqual(report(self.worker)["goal"]["balance"], 1800000)

    def test_payday_resets_flexible_cycle_and_posts_due_events_once(self):
        after = advance(self.worker)
        self.assertEqual(after.today, date(2027, 1, 15))
        self.assertEqual(report(after)["cash"], 3300000)
        self.assertEqual(report(after)["goal"]["balance"], 2100000)
        self.assertEqual(report(after)["flexible_spent"], 0)
        next_month = advance(after)
        ids = [entry.event_id for entry in next_month.entries if entry.event_id]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(shift(date(2027, 1, 31), "monthly", 2), date(2027, 3, 31))

    def test_zero_savings_has_no_forecast(self):
        budget = self.worker.model_copy(update={"goal": self.worker.goal.model_copy(update={"contribution": 0})})
        self.assertIsNone(report(budget)["goal"]["date"])


if __name__ == "__main__":
    unittest.main()
