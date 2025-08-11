#!/usr/bin/env python3
"""
Enhanced Python launcher with config/heuristic entrypoint discovery and
stdout capture to launcher.log.
"""
from pathlib import Path
import sys
import json
import logging
import runpy
import importlib.util
import datetime
from io import StringIO
from contextlib import redirect_stdout

LOG = Path.cwd() / "launcher.log"
def log(msg, level="INFO"):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {level} {msg}"
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass
    print(line)

def load_launcher_config(script_dir: Path) -> dict:
    cfg_path = script_dir / "launcher_config.json"
    if not cfg_path.exists():
        return {}
    try:
        with open(cfg_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def discover_entrypoint_by_heuristics(root: Path) -> Path:
    # Very lightweight heuristic: scan for a py file with __name__ == '__main__' or def main()
    for dirpath, _, filenames in __import__("os").walk(str(root)):
        for fn in filenames:
            if not fn.endswith(".py"):
                continue
            p = Path(dirpath) / fn
            try:
                with open(p, "r", encoding="utf-8") as f:
                    text = f.read(2048)
            except Exception:
                continue
            if "__name__ == '__main__'" in text or "def main(" in text:
                return p
    return None

def find_entrypoint(script_dir: Path, candidates=None) -> Path:
    cfg = load_launcher_config(script_dir)
    for candidate in cfg.get("entrypoints", []) or []:
        p = script_dir / candidate
        if p.exists() and p.is_file():
            log(f"Using configured entrypoint: {p}", "INFO")
            return p
    if candidates is None:
        candidates = ["main.py", "app.py", "run.py", "start.py", "bootstrap.py"]
    for name in candidates:
        p = script_dir / name
        if p.exists() and p.is_file():
            log(f"Using candidate entrypoint: {p}", "INFO")
            return p
    ent = discover_entrypoint_by_heuristics(script_dir)
    if ent:
        log(f"Heuristically discovered entrypoint: {ent}", "INFO")
        return ent
    return None

def execute_entrypoint(entry: Path, argv):
    if not entry:
        log("No entrypoint found; exiting with error.", "ERROR")
        sys.exit(1)
    log(f"Executing entrypoint: {entry}", "INFO")
    # Try to load as a module with a main() function
    try:
        spec = importlib.util.spec_from_file_location("__entry__", str(entry))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)  # type: ignore
        main_func = getattr(mod, "main", None)
        if callable(main_func):
            args = argv[:]
            buf = StringIO()
            with redirect_stdout(buf):
                try:
                    result = main_func(*args)  # type: ignore
                except SystemExit as se:
                    sys.exit(se.code)
            out = buf.getvalue()
            if out:
                for line in out.splitlines():
                    log(line, "INFO")
            if isinstance(result, int):
                sys.exit(result)
            return 0
        else:
            # Fallback to executing script as __main__ in the same process
            buf = StringIO()
            with redirect_stdout(buf):
                runpy.run_path(str(entry), run_name="__main__")
            out = buf.getvalue()
            if out:
                for line in out.splitlines():
                    log(line, "INFO")
            return 0
    except Exception as e:
        log(f"Error running entrypoint: {e}", "ERROR")
        sys.exit(1)

def main():
    root = Path.cwd()
    entry = find_entrypoint(root)
    log(f"Resolved entrypoint: {entry}", "INFO")
    ret = execute_entrypoint(entry, sys.argv[1:])
    sys.exit(ret)

if __name__ == "__main__":
    main()

