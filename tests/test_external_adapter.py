"""Offline checks for third-party data normalization and ranking contract."""
import importlib.util
import json
import pathlib
import unittest
ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("sync_external", ROOT / "scripts/sync_external.py")
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

class ExternalSyncTests(unittest.TestCase):
    def test_cards_adapter(self):
        rows = sync.compact_rows({"cards":[{"id":"card-a","name_zh":"測試卡","issuer_id":"bank-a"}]}, "cards")
        self.assertEqual(rows[0]["id"], "card-a")
        self.assertEqual(rows[0]["name"], "測試卡")
    def test_wallet_adapter(self):
        rows = sync.compact_rows({"wallets":[{"id":"line_pay","name_zh":"LINE Pay"}]}, "wallets")
        self.assertEqual(rows[0]["name"], "LINE Pay")
    def test_unknown_fields_not_made_up(self):
        rows = sync.compact_rows({"cards":[{"id":"c1","rate":0.5}]}, "cards")
        self.assertEqual(rows[0]["summary"], "")
        self.assertEqual(rows[0]["url"], "")
    def test_rankings_if_present(self):
        path = ROOT / "data/external/rankings/seven-eleven.json"
        if not path.exists():
            self.skipTest("snapshot not synced yet")
        obj = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(obj["slug"], "seven-eleven")
        self.assertIn("CC BY 4.0", obj["license"])
        self.assertIsInstance(obj["entries"], list)
        for row in obj["entries"][:10]:
            self.assertIn("card_id", row)
            for key in ("basic","once","best"):
                if row.get(key) is not None:
                    self.assertIsInstance(row[key], dict)
if __name__ == "__main__":
    unittest.main()
