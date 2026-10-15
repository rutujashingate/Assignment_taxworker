"""Read-only, standard-library validation of the exact delivered packet."""
from collections import Counter
from decimal import Decimal
from hashlib import sha256
from pathlib import Path
import json
import re

PATH = Path(__file__).resolve().parents[1] / "data/okafor_lindqvist_2025_packet.json"
HASH = "ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19"
raw = PATH.read_bytes()
assert sha256(raw).hexdigest() == HASH, "Original packet bytes changed"
packet = json.loads(raw)
documents = {x["id"]: x for x in packet["documents"]}
values = {x["id"]: x for x in packet["extracted_values"]}
versions = {x["version"]: x for x in packet["return_versions"]}
counts = {
    "documents": len(documents), "pages": sum(len(x["pages"]) for x in documents.values()),
    "extracted_values": len(values), "extraction_states": dict(Counter(x["extraction"]["status"] for x in documents.values())),
    "lines": {k: len(v["lines"]) for k, v in versions.items()}, "timeline": len(packet["timeline"]),
    "alternatives": len(packet["what_if"]["alternatives"]), "staff": len(packet["firm"]["staff"]),
    "client_users": len(packet["firm"]["client_users"]),
}
assert counts == {
    "documents": 74, "pages": 199, "extracted_values": 3012,
    "extraction_states": {"extracted": 68, "partial": 2, "not_extracted": 4},
    "lines": {"v1": 625, "v2": 625, "v3": 627}, "timeline": 29, "alternatives": 5, "staff": 6, "client_users": 2,
}, counts
assert len(documents) == len(packet["documents"]) and len(values) == len(packet["extracted_values"])
for document in documents.values():
    assert len(document["pages"]) == document["page_count"]
    assert document["extraction"]["values"] == sum(v["document_id"] == document["id"] for v in values.values())
for value in values.values():
    assert value["page"] in {p["page"] for p in documents[value["document_id"]]["pages"]}

registry = {**documents, **values, **versions}
for group in list(packet["client"].values()) + [packet["household"]["people"], packet["timeline"], packet["firm"]["staff"], packet["firm"]["client_users"]]:
    registry.update({x["id"]: x for x in group})


def pointer(root, path):
    if not path:
        return root
    assert path.startswith("/")
    for part in path[1:].split("/"):
        part = part.replace("~1", "/").replace("~0", "~")
        root = root[int(part)] if isinstance(root, list) else root[part]
    return root


def resolve(ref, version):
    if ref in registry:
        return registry[ref]
    lines = {x["key"]: x for x in version["lines"]}
    if ref in lines:
        return lines[ref]
    if ref.startswith("py:"):
        return pointer(packet["prior_years"], ref[3:])
    if ref.startswith("agency:"):
        return pointer(packet["tax_agency_records"], ref[7:])
    if ref.startswith("asset:"):
        return next(x for x in version["assets"] + packet["prior_years"]["asset_records"] if x["asset_id"] == ref[6:])
    if ref.startswith(("household:", "timeline:")):
        return registry[ref.split(":", 1)[1]]
    if ref.startswith("doc:"):
        match = re.fullmatch(r"doc:(D\d+)#page(\d+)", ref)
        assert match
        return next(p for p in documents[match[1]]["pages"] if p["page"] == int(match[2]))
    if ref.startswith("ref:"):
        parts = ref[4:].split(".")
        if parts[0] == "param":
            parts = parts[1:]
        root = packet["engine_reference"]["parameters"]
        for part in parts:
            root = root[part]
        return root
    raise KeyError(ref)


graphs = {}
for name, version in versions.items():
    lines = {x["key"]: x for x in version["lines"]}
    assert len(lines) == len(version["lines"])
    state = {}

    def visit(key):
        assert state.get(key) != 1, f"Calculation cycle: {name}/{key}"
        if state.get(key) == 2:
            return
        state[key] = 1
        line = lines[key]
        assert line["rule"] in packet["engine_reference"]["rules"]
        for ref in line["sources"]:
            resolve(ref, version)
        for ref in line["inputs"]:
            assert ref in lines, (name, key, ref)
            visit(ref)
        state[key] = 2

    for key in lines:
        visit(key)
    graphs[name] = {"input_edges": sum(len(x["inputs"]) for x in lines.values()), "source_edges": sum(len(x["sources"]) for x in lines.values()), "missing_line_refs": 0, "cycles": 0}

unresolved = []
checked = Counter()


def check(ref, path, version, kind):
    checked[kind] += 1
    try:
        resolve(ref, version)
    except (KeyError, StopIteration, IndexError, AssertionError):
        unresolved.append({"path": path, "ref": ref})


def walk(obj, path, version):
    if isinstance(obj, dict):
        if obj.get("version") in versions:
            version = versions[obj["version"]]
        for key, value in obj.items():
            here = f"{path}/{key}"
            if key in ("sources", "refs", "documents_used", "documents_superseded") and isinstance(value, list):
                for i, ref in enumerate(value):
                    if isinstance(ref, str):
                        check(ref, f"{here}/{i}", version, key)
            if key == "line_sources":
                for line, refs in value.items():
                    for ref in [refs] if isinstance(refs, str) else refs:
                        check(ref, f"{here}/{line}", version, key)
            walk(value, here, version)
    elif isinstance(obj, list):
        for i, value in enumerate(obj):
            walk(value, f"{path}/{i}", version)


walk(packet, "", versions["v3"])
assert unresolved == [{"path": f"/prior_years/asset_records/{i}/sources/0", "ref": "prior_preparer_depreciation_schedule"} for i in range(6)], unresolved
v3 = versions["v3"]
lines = {x["key"]: x for x in v3["lines"]}
assert lines["F1040.2b"]["inputs"] == ["SchB.4"]
assert lines["SchB.4"]["inputs"] == ["SchB.2"]
for key, ref, doc in [("SchB.1.1", "ev-0492", "D28"), ("SchB.1.2", "ev-0538", "D29")]:
    assert key in lines["SchB.2"]["inputs"]
    assert lines[key]["value"] == 1840 and lines[key]["sources"] == [ref]
    assert values[ref]["document_id"] == doc and "account ending 7731" in documents[doc]["pages"][0]["printed_content"]
pages = documents["D23"]["pages"]
totals = [int(re.search(r"Page total ([\d,]+) miles", x["printed_content"])[1].replace(",", "")) for x in pages]
assert totals == [2600, 3700, 3700, 1800]
assert pages[2]["printed_content"][pages[2]["printed_content"].index("Mileage log May-Aug."):] == pages[1]["printed_content"]
assert lines["SchC.44a"]["value"] == sum(totals) == 11800 and sum(totals)-totals[2] == 8100
assert lines["SchC.1"]["value"] == 151300 + 12400
assert "12,400.00 arrived through Paywell" in documents["D15"]["pages"][2]["printed_content"]
assert values["ev-1076"]["value"] == "2024"
assert sum(Decimal(str(x["amount"])) for x in packet["tax_agency_records"]["ftb_account"]["tax_year_2025_payments"]) == 10500
assert lines["F540NR.72"]["value"] == 14000
for doc in ("D30", "D31"):
    assert "proceeds 250.00 basis 310.00" in resolve(f"doc:{doc}#page32", v3)["printed_content"]
    assert not any(x["document_id"] == doc and x["page"] == 32 for x in values.values())
assert "D10" not in {values[ref]["document_id"] for ref in lines["F1040.1a"]["sources"]}
for alternative in packet["what_if"]["alternatives"]:
    for area in ("federal", "california"):
        scenario = alternative[area]
        assert scenario["base"] == v3["summary"][area]
        assert scenario["alternative"]["total_tax"]-scenario["base"]["total_tax"] == scenario["total_tax_change"]
    for line in alternative["changed_lines"]:
        if line["change"] == "changed":
            assert line["old"] == lines[line["key"]]["value"]
assert raw == PATH.read_bytes(), "Validator changed source bytes"
print(json.dumps({"status": "PASS", "bytes": len(raw), "sha256": HASH, "top_level_keys": list(packet), "counts": counts, "graphs": graphs, "reference_checks": dict(checked), "disclosed_provenance_gaps": unresolved, "named_examples": "PASS", "scenario_consistency": "PASS", "source_unchanged": True}, indent=2))
