#!/usr/bin/env python3
"""
PyInstaller-based Windows executable builder for the Crypto-Futures project.

This script packages the Python launcher (launcher.py) into a single
executable suitable for distribution on Windows. It expects PyInstaller
to be available in the environment.
"""
import subprocess
import sys
from pathlib import Path

def ensure_pyinstaller_available() -> bool:
    try:
        subprocess.run([sys.executable, "-m", "PyInstaller", "--version"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False

def build_executable():
    launcher = Path(__file__).resolve().parent / "launcher.py"
    if not launcher.exists():
        print(f"Launcher not found at {launcher}")
        sys.exit(1)
    cmd = [sys.executable, "-m", "PyInstaller", "--onefile", "--name", "CryptoFuturesLauncher", str(launcher)]
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True)

def main():
    if not ensure_pyinstaller_available():
        print("PyInstaller is not available in this environment. Please install PyInstaller (pip install pyinstaller) and rerun.")
        sys.exit(2)
    build_executable()

if __name__ == "__main__":
    main()

