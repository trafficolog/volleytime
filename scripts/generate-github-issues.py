#!/usr/bin/env python3
"""
Генератор GitHub Issues из task-карточек Volley Time.

Читает docs/tasks/*.md, формирует для каждой задачи:
  - title: [N.M.K] Заголовок
  - body: полный markdown карточки + Depends on + Estimate
  - labels: phase:N, type:*, priority:mvp (если в R0)
  - milestone: релиз по фазе (RELEASES.md)

Вывод:
  --format jsonl  → issues.jsonl (для API/скриптов)
  --format csv    → issues.csv  (для просмотра/импорта)
  --format gh     → gh-commands.sh (готовые gh issue create)

Использование:
  python scripts/generate-github-issues.py --format gh --release v0.1.0
  python scripts/generate-github-issues.py --format jsonl   # все релизы
"""
import re, json, csv, sys, argparse
from pathlib import Path

# фаза → релиз (milestone) из RELEASES.md
PHASE_TO_RELEASE = {
    "3": "v0.1.0 — MVP: One Company", "4": "v0.1.0 — MVP: One Company",
    "5": "v0.1.0 — MVP: One Company", "6": "v0.1.0 — MVP: One Company",
    "8": "v0.1.0 — MVP: One Company", "9": "v0.1.0 — MVP: One Company",
    "15": "v0.2.0 — Automation",
    "10": "v0.3.0 — Beta",
    "7": "v1.0.0 — Monetization",
    "11": "v1.2.0 — Contributions", "12": "v1.1.0 — Payments Online",
    "13": "v1.1.0 — Payments Online", "14": "v1.3.0 — Reports",
    "16": "v2.0.0 — Competitions", "17": "v2.0.0 — Competitions",
    "18": "v2.1.0 — CRM Pro",
}
MVP_PHASES = {"3", "4", "5", "6", "8", "9"}
ROLE_TO_LABEL = {
    "BACK": "type:backend", "FE": "type:frontend", "DEVOPS": "type:devops",
    "QA": "type:qa", "DB": "type:db", "SECURITY": "type:security",
    "OPS": "type:ops", "DOCS": "type:docs", "PRODUCT": "type:docs",
}

def parse_card(p: Path):
    text = p.read_text()
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.DOTALL)
    if not m: return None
    fm, body = m.group(1), m.group(2)
    def f(name):
        mm = re.search(rf"^{name}:\s*(.+)$", fm, re.MULTILINE)
        return mm.group(1).strip().strip('"') if mm else None
    def flist(name):
        mm = re.search(rf"^{name}:\s*\n((?:\s*-\s*.+\n?)+)", fm, re.MULTILINE)
        if mm: return [x.strip().strip('"') for x in re.findall(r"-\s*(.+)", mm.group(1))]
        mm = re.search(rf"^{name}:\s*(\[.*?\])", fm, re.DOTALL)
        if mm: return re.findall(r'"([^"]+)"', mm.group(1))
        return []
    tid = f("id"); phase = f("phase")
    if not tid or not phase: return None
    # заголовок из первой строки # Task ...
    hm = re.search(r"^#\s+Task\s+[\d.]+:\s*(.+)$", body, re.MULTILINE)
    title_text = hm.group(1).strip() if hm else "?"
    return {
        "id": tid, "phase": phase,
        "title": f"[{tid}] {title_text}",
        "body_md": body.strip(),
        "roles": flist("roles"),
        "depends_on": flist("depends_on"),
        "estimate": f("estimated_hours"),
        "release": PHASE_TO_RELEASE.get(phase, "unassigned"),
        "is_mvp": phase in MVP_PHASES,
    }

def build_labels(card):
    labels = [f"phase:{card['phase']}"]
    seen = set()
    for r in card["roles"]:
        l = ROLE_TO_LABEL.get(r)
        if l and l not in seen: labels.append(l); seen.add(l)
    if card["is_mvp"]: labels.append("priority:mvp")
    return labels

def build_body(card):
    parts = [card["body_md"], "\n\n---"]
    if card["depends_on"]:
        parts.append(f"**Depends on:** {', '.join(card['depends_on'])} "
                     f"_(закрыть их issues до начала)_")
    if card["estimate"]:
        parts.append(f"**Estimate:** {card['estimate']} ч")
    parts.append(f"**Карточка:** `docs/tasks/{card['id'].replace('.','-')}-*.md`")
    return "\n".join(parts)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--format", choices=["jsonl", "csv", "gh"], default="jsonl")
    ap.add_argument("--release", help="фильтр по версии, напр. v0.1.0")
    ap.add_argument("--tasks-dir", default="docs/tasks")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    cards = []
    for p in sorted(Path(args.tasks_dir).glob("*.md")):
        c = parse_card(p)
        if not c: continue
        if args.release and not c["release"].startswith(args.release): continue
        cards.append(c)
    # порядок: фаза, затем id
    cards.sort(key=lambda c: [int(x) for x in c["id"].split(".")])

    out = args.out or f"issues.{ 'sh' if args.format=='gh' else args.format }"
    if args.format == "jsonl":
        with open(out, "w") as fh:
            for c in cards:
                fh.write(json.dumps({
                    "title": c["title"], "body": build_body(c),
                    "labels": build_labels(c), "milestone": c["release"],
                }, ensure_ascii=False) + "\n")
    elif args.format == "csv":
        with open(out, "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["id", "title", "release", "labels", "depends_on", "estimate"])
            for c in cards:
                w.writerow([c["id"], c["title"], c["release"],
                            " ".join(build_labels(c)), " ".join(c["depends_on"]),
                            c["estimate"] or ""])
    elif args.format == "gh":
        with open(out, "w") as fh:
            fh.write("#!/usr/bin/env bash\nset -euo pipefail\n")
            fh.write("# Сгенерировано generate-github-issues.py\n")
            fh.write("# Требует: gh CLI (авторизован), созданные milestones и labels\n\n")
            for c in cards:
                bodyfile = f"/tmp/vt-issue-{c['id'].replace('.','-')}.md"
                fh.write(f"cat > {bodyfile} << 'BODY'\n{build_body(c)}\nBODY\n")
                labels = ",".join(build_labels(c))
                title = c["title"].replace('"', '\\"')
                fh.write(f'gh issue create --title "{title}" '
                         f'--body-file {bodyfile} --label "{labels}" '
                         f'--milestone "{c["release"]}"\n\n')

    print(f"Готово: {len(cards)} задач → {out} (format={args.format}"
          + (f", release={args.release}" if args.release else ", все релизы") + ")")

if __name__ == "__main__":
    main()
