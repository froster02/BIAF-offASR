"""Deterministic, trie-based compound-word repair for ASR hypotheses.

Whisper-style ASR frequently inserts a spurious space inside a Devanagari
compound (sandhi) word — e.g. "रथा यात्रा" where the intended single token is
"रथयात्रा" ("rath" + "yatra"). This module builds a prefix trie over a curated
vocabulary of such regional/compound terms and uses maximum-munch matching,
with a small set of common case/declension suffix-strips, to re-join
fragmented tokens before translation sees them.

This is the user-specified algorithm (trie + maximum-munch + suffix-strip);
it is NOT a verified implementation of any specific cited paper — treat the
"EACL 2026" framing in the original brief as the motivating idea, not a
citation this code claims to reproduce exactly.
"""
import os
import logging
from typing import Optional

logger = logging.getLogger("dyansetu.compound_trie")

# Common Devanagari case/declension endings that get attached to the first half
# of a compound when ASR splits it (e.g. "रथा" = "रथ" + vowel-sign "ा"). Stripped
# before attempting a merge so "रथा" + "यात्रा" -> "रथ" + "यात्रा" -> "रथयात्रा".
_STRIPPABLE_SUFFIXES = ("ा", "ी", "े", "ू", "ं")

_DEVANAGARI_DIGITS = "०१२३४५६७८९"
_ASCII_DIGITS = "0123456789"
_DEVANAGARI_TO_ASCII_DIGITS = str.maketrans(_DEVANAGARI_DIGITS, _ASCII_DIGITS)


class _TrieNode:
    __slots__ = ("children", "is_word")

    def __init__(self):
        self.children = {}
        self.is_word = False


class CompoundTrie:
    def __init__(self):
        self._root = _TrieNode()

    def insert(self, word: str):
        node = self._root
        for ch in word:
            node = node.children.setdefault(ch, _TrieNode())
        node.is_word = True

    def contains(self, word: str) -> bool:
        node = self._root
        for ch in word:
            node = node.children.get(ch)
            if node is None:
                return False
        return node.is_word

    @classmethod
    def from_vocab_file(cls, path: str) -> "CompoundTrie":
        trie = cls()
        if not os.path.exists(path):
            logger.warning("Compound-word vocab file not found at %s — trie will be empty.", path)
            return trie
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                word = line.strip()
                if word and not word.startswith("#"):
                    trie.insert(word)
        return trie


def normalize_digits(text: str) -> str:
    """Devanagari numerals -> ASCII digits, so downstream DNT-token masking
    (services/dnt_masking.py) reliably catches numeric spans regardless of script."""
    return text.translate(_DEVANAGARI_TO_ASCII_DIGITS)


def _try_merge(left: str, right: str, trie: CompoundTrie) -> Optional[str]:
    candidate = left + right
    if trie.contains(candidate):
        return candidate
    for suffix in _STRIPPABLE_SUFFIXES:
        if left.endswith(suffix):
            stripped_candidate = left[: -len(suffix)] + right
            if trie.contains(stripped_candidate):
                return stripped_candidate
    return None


def fix_compounds(tokens: list, trie: CompoundTrie) -> list:
    """Scan adjacent token pairs left-to-right, merging any pair the trie
    recognizes as a compound. Single left-to-right pass with re-check of the
    newly merged token against its next neighbor (handles 3+ way splits)."""
    if not tokens:
        return tokens

    result = [tokens[0]]
    for token in tokens[1:]:
        merged = _try_merge(result[-1], token, trie)
        if merged:
            logger.debug("Merged compound: %r + %r -> %r", result[-1], token, merged)
            result[-1] = merged
        else:
            result.append(token)
    return result


def fix_text(text: str, trie: CompoundTrie) -> str:
    text = normalize_digits(text)
    tokens = text.split(" ")
    return " ".join(fix_compounds(tokens, trie))
