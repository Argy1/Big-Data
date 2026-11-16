"""Readable sensor and freeway names for the UI.

Raw PEMS names look like "Airport Blvd rm-s-diag", "WB 237  TO NB101" or "LARK AVE".
The design shows "Airport Blvd", "WB 237 ke NB 101", "Lark Ave". The raw name is
always kept as `name_raw` in the API.
"""

from __future__ import annotations

import re

FWY_PREFIX = {17: "SR", 85: "SR", 87: "SR", 237: "SR", 101: "US", 280: "I", 680: "I", 880: "I"}

# ramp / detector codes at the end: "rm-s-diag", "RM-N-DIA", "Rm-s-diag", "rm-n-fly/diag",
# "rm-s-", "off-n-diag", "on-n-diag", "rn-s-loo/diag", "RM-IN-DIAG"
_RAMP_CODE = re.compile(r"\s+(?:rm|rn|off|on)-[a-z]+(?:-[\w/]*)?\s*$", re.IGNORECASE)
_OFF_RAMP = re.compile(r"\s+off\s+ramp\s*$", re.IGNORECASE)
_ABBREV_DOT = re.compile(r"(\w)\.(?=\s|$)")  # "Ave." -> "Ave", "N. of" -> "N of"
_TO = re.compile(r"\bto\b", re.IGNORECASE)
_DIR_NUM = re.compile(r"\b(NB|SB|EB|WB)(\d+)")  # "NB101" -> "NB 101"
_ORDINAL = re.compile(r"\b(\d+)(ST|ND|RD|TH)\b")

# tokens kept upper-case when title-casing an ALL-CAPS name
_KEEP_UPPER = {"N", "S", "E", "W", "NB", "SB", "EB", "WB", "IC", "OC", "HOV", "POC", "I/C"}
_LOWER = {"OF", "TO", "KE", "AND"}


def _title_all_caps(name: str) -> str:
    words = []
    for w in name.split(" "):
        if w in _KEEP_UPPER or not w.isalpha():
            words.append(w)
        elif w in _LOWER:
            words.append(w.lower())
        else:
            words.append(w.capitalize())
    return " ".join(words)


def clean_name(raw: str) -> str:
    name = _RAMP_CODE.sub("", raw.strip())
    name = _OFF_RAMP.sub("", name)
    name = _ABBREV_DOT.sub(r"\1", name)
    name = _DIR_NUM.sub(r"\1 \2", name)
    name = re.sub(r"\s+", " ", name).strip()
    letters = [c for c in name if c.isalpha()]
    if letters and all(c.isupper() for c in letters):
        name = _title_all_caps(_ORDINAL.sub(lambda m: m.group(1) + m.group(2).lower(), name))
    name = _TO.sub("ke", name)
    return name or raw.strip()


# Names that are construction / contract placeholders, not places: show "Sensor <id>" instead
_PLACEHOLDER = re.compile(r"^\(future\)|^4A5324\s+loc\s+\d+$", re.IGNORECASE)


def display_name(raw: str, sensor_id: int) -> str:
    if _PLACEHOLDER.search(raw.strip()):
        return f"Sensor {sensor_id}"
    return clean_name(raw)


def fwy_label(fwy: int, direction: str) -> str:
    """101, "S" -> "US 101 S"; 880, "N" -> "I-880 N"."""
    prefix = FWY_PREFIX.get(int(fwy), "SR")
    road = f"I-{fwy}" if prefix == "I" else f"{prefix} {fwy}"
    return f"{road} {direction}".strip()
