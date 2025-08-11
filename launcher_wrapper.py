#!/usr/bin/env python3
"""
Wrapper to reliably launch Crypto-Futures from the repo.

- If a Windows one-file launcher exists (dist/CryptoFuturesLauncher.exe), it will
  be executed with a minimal environment and the wrapper will exit after the
  child process completes.
- If no exe is available, the wrapper falls back to invoking the Python launcher
  directly (python launcher.py) and logs all steps to launcher_wrapper.log.
"""
from pathlib import Path
import subprocess
import sys
import datetime
import os
import argparse

LOG = Path.cwd() / "launcher_wrapper.log"

def log(msg: str, to_stdout: bool = False):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass
    if to_stdout:
        print(line)

def parse_args():
    parser = argparse.ArgumentParser(description="Crypto-Futures launcher wrapper with verbose mode.")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose logging to stdout")
    return parser.parse_known_args()

def main():
    args, _ = parse_args()
    verbose = bool(getattr(args, "verbose", False))

    log("Launcher wrapper started.", to_stdout=verbose)
    if verbose:
        log("Verbose mode enabled.", to_stdout=True)

    exe_path = Path.cwd() / "dist" / "CryptoFuturesLauncher.exe"
    if exe_path.exists():
        log(f"Found packaged exe: {exe_path}", to_stdout=verbose)
        try:
            ret = subprocess.run([str(exe_path)], env=os.environ, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True).returncode
            log(f"Packaged launcher exited with code {ret}", to_stdout=verbose)
            sys.exit(ret)
        except Exception as e:
            log(f"Failed to run packaged exe: {e}", to_stdout=verbose)
            log("Falling back to Python launcher", to_stdout=verbose)

    # Fallback: run the Python launcher directly
    launcher_py = Path.cwd() / "enhanced_launcher.py"
    if not launcher_py.exists():
        log("No enhanced_launcher.py found; cannot start project.", to_stdout=verbose)
        sys.exit(1)
    log("Running python enhanced_launcher.py as fallback.", to_stdout=verbose)
    ret = subprocess.run([sys.executable, str(launcher_py)], env=os.environ).returncode
    log(f"Python launcher exited with code {ret}", to_stdout=verbose)
    sys.exit(ret)

if __name__ == "__main__":
    main()
