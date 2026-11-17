import unittest
from datetime import date

from antive.parser import preview

TODAY = date(2027, 1, 11)


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
