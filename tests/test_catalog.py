"""Basic schema and reward invariants; run with python -m unittest discover -s tests."""
import json
import pathlib
import unittest
from datetime import date
ROOT = pathlib.Path(__file__).resolve().parents[1]

class CatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / "data/cards.json").read_text(encoding="utf-8"))

    def test_cards_and_unique_ids(self):
        cards = self.data["cards"]
        self.assertGreaterEqual(len(cards), 6)
        self.assertEqual(len(cards), len({c["id"] for c in cards}))
        self.assertGreaterEqual(len({c["bank"] for c in cards}), 6)

    def test_official_sources_and_safe_base_rates(self):
        for card in self.data["cards"]:
            with self.subTest(card=card["id"]):
                self.assertTrue(card["source"].startswith("https://"))
                self.assertTrue(card["application"].startswith("https://"))
                rate = card["base"]["rate"]
                self.assertTrue(rate is None or 0 <= rate <= 1)
                self.assertTrue(card["fee"] is None or card["fee"] >= 0)
                self.assertTrue(card["income"] is None or card["income"] >= 0)

    def test_bonus_caps_and_dates(self):
        for card in self.data["cards"]:
            ids = [r["id"] for r in card["rules"]]
            self.assertEqual(len(ids), len(set(ids)))
            for rule in card["rules"]:
                with self.subTest(card=card["id"], rule=rule["id"]):
                    self.assertTrue(0 <= rule["rate"] <= 1)
                    self.assertTrue(rule["cap"] is None or rule["cap"] >= 0)
                    if rule.get("end"):
                        date.fromisoformat(rule["end"])
                    if rule.get("start"):
                        date.fromisoformat(rule["start"])
                    self.assertIn(rule["period"], ["month", "statement"])
if __name__ == "__main__":
    unittest.main()
