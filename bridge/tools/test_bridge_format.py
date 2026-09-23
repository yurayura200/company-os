"""bridge/ 書式セルフテスト。

INSTRUCTIONS.md / STATUS.md が claude-bridge 実証版と互換の書式を保っているかを
静的に検証する。ネットワーク・音・外部プロセスは使わない。
"""
import re
import unittest
from pathlib import Path

BRIDGE = Path(__file__).resolve().parents[1]
VALID_STATES = {"未処理", "実行中", "完了", "要承認"}
ID_RE = re.compile(r"^## 指示 (\d{4}-\d{2}-\d{2}-\d{3})$", re.MULTILINE)


def strip_code_blocks(text: str) -> str:
    """フェンス付きコードブロック（ひな形）を除去する。ひな形は指示として数えない。"""
    return re.sub(r"```.*?```", "", text, flags=re.DOTALL)


class BridgeFormatTest(unittest.TestCase):
    def test_required_files_exist(self):
        for name in ("README.md", "INSTRUCTIONS.md", "STATUS.md"):
            self.assertTrue((BRIDGE / name).is_file(), f"bridge/{name} がない")

    def test_instructions_have_valid_ids_and_states(self):
        text = strip_code_blocks((BRIDGE / "INSTRUCTIONS.md").read_text(encoding="utf-8"))
        ids = ID_RE.findall(text)
        self.assertGreaterEqual(len(ids), 1, "指示が 1 件もない")
        self.assertEqual(len(ids), len(set(ids)), "指示 ID が重複している")
        # 各指示ブロックに必須項目と有効な状態があること
        blocks = re.split(r"^## 指示 ", text, flags=re.MULTILINE)[1:]
        # 見出しの数と正規 ID の数が一致 = 不正形式の見出しが紛れていない
        self.assertEqual(len(blocks), len(ids), "ID 形式が不正な指示見出しがある")
        for block in blocks:
            block_id = block.splitlines()[0].strip()
            self.assertRegex(block_id, r"^\d{4}-\d{2}-\d{2}-\d{3}$",
                             f"指示見出しの ID 形式が不正: {block_id!r}")
            for field in ("日時", "状態", "対象", "内容"):
                self.assertRegex(block, rf"(?m)^- {field}: ",
                                 f"指示 {block_id} に構造化された {field} 行がない")
            states = re.findall(r"(?m)^- 状態: (\S+)", block)
            self.assertEqual(len(states), 1, f"指示 {block_id} の状態行が 1 行ではない: {states}")
            self.assertIn(states[0], VALID_STATES, f"指示 {block_id} の状態が不正: {states[0]}")

    def test_template_is_not_counted_as_instruction(self):
        raw = (BRIDGE / "INSTRUCTIONS.md").read_text(encoding="utf-8")
        self.assertIn("YYYY-MM-DD-NNN", raw, "ひな形コードブロックが存在しない")
        stripped = strip_code_blocks(raw)
        self.assertNotIn("YYYY-MM-DD-NNN", stripped,
                         "コードブロック除去が機能しておらず、ひな形が指示として数えられ得る")

    def test_status_has_required_sections(self):
        text = (BRIDGE / "STATUS.md").read_text(encoding="utf-8")
        for needle in ("最終更新:", "見張り状態:", "## 完成済み機能", "## 数値ステータス"):
            self.assertIn(needle, text, f"STATUS.md に {needle} がない")


if __name__ == "__main__":
    unittest.main()
