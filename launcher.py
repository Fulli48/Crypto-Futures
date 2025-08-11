#!/usr/bin/env python3
"""
Windows launcher for Crypto-Futures project.

This bootstrapper installs dependencies in a local virtual environment,
builds a Windows one-file executable with PyInstaller (on first run),
and then launches the project's entrypoint. A child-mode avoids recursive
packaging when the launcher exe calls itself.
"""
from pathlib import Path
import json
import os
import importlib.util
import runpy
import sys
import logging
import os
import subprocess
import venv
import shutil
import platform

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")

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
    # Scan for files that contain a __main__ entry or a main() function
    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            if not fn.endswith(".py"):
                continue
            p = Path(dirpath) / fn
            # Limit how much we read to avoid heavy IO; read small chunks
            try:
                with open(p, "r", encoding="utf-8") as f:
                    text = f.read(2048)
            except Exception:
                continue
            if "__name__ == '__main__'" in text or '"__main__"' in text or "def main(" in text:
                return p
    return None

def find_entrypoint(script_dir: Path, candidates=None) -> Path:
    cfg = load_launcher_config(script_dir)
    # 1) Explicit entrypoints from config (ordered)
    for candidate in cfg.get("entrypoints", []) or []:
        p = script_dir / candidate
        if p.exists() and p.is_file():
            return p
    # 2) If explicit candidates provided, try them in order
    if candidates is None:
        candidates = ["main.py", "app.py", "run.py", "start.py", "bootstrap.py"]
    for name in candidates:
        p = script_dir / name
        if p.exists() and p.is_file():
            return p
    # 3) Heuristic discovery (recursively search for __main__ or main())
    found = discover_entrypoint_by_heuristics(script_dir)
    if found:
        return found
    return None

def ensure_venv(venv_dir: Path) -> Path:
    if not venv_dir.exists():
        venv_dir.mkdir(parents=True, exist_ok=True)
        builder = venv.EnvBuilder(with_pip=True)
        builder.create(str(venv_dir))
    # Return path to python executable inside venv
    if platform.system().lower().startswith("win"):
        return venv_dir / "Scripts" / "python.exe"
    else:
        return venv_dir / "bin" / "python"

def run_in_venv(python_exe: Path, args):
    cmd = [str(python_exe)] + list(args)
    return subprocess.run(cmd)

def install_requirements(python_exe: Path, project_root: Path) -> bool:
    req = project_root / "requirements.txt"
    if not req.exists():
        return True
    cmd = [str(python_exe), "-m", "pip", "install", "-r", str(req)]
    return subprocess.run(cmd, check=False).returncode == 0

def ensure_pyinstaller(python_exe: Path) -> bool:
    cmd = [str(python_exe), "-m", "pip", "install", "pyinstaller"]
    return subprocess.run(cmd, check=False).returncode == 0

def build_executable(python_exe: Path, project_root: Path) -> bool:
    dist_dir = project_root / "dist"
    build_dir = project_root / "build"  # PyInstaller build dir
    if dist_dir.exists() and any(dist_dir.iterdir()):
        return True
    launcher_script = Path(__file__).resolve()
    cmd = [str(python_exe), "-m", "PyInstaller", "--onefile", "--name", "CryptoFuturesLauncher", "--distpath", str(dist_dir), "--workpath", str(build_dir), str(launcher_script)]
    print("Packaging launcher into exe...")
    return subprocess.run(cmd).returncode == 0

def run_project_entry(python_exe: Path, project_root: Path, entry: Path, extra_args=None) -> int:
    cmd = [str(python_exe), str(entry)]
    if extra_args:
        cmd += list(extra_args)
    return subprocess.run(cmd).returncode

def main():
    # Child mode avoids recursive packaging when the built exe launches the project
    child_mode = os.environ.get("CRYPTO_LAUNCHER_CHILD", "0") == "1"
    project_root = Path(os.environ.get("CRYPTO_PROJECT_ROOT", str(Path.cwd())))
    if child_mode:
        # Run the project's entrypoint directly from project root
        entry = find_entrypoint(project_root)
        if not entry:
            logging.error("Child mode: No entrypoint found in %s", project_root)
            sys.exit(1)
        # Prefer venv's python if available
        venv_dir = project_root / ".venv"
        vpython = None
        if venv_dir.exists():
            vpython = Path(venv_dir) / ("Scripts" if platform.system().lower().startswith("win") else "bin") / ("python.exe" if platform.system().lower().startswith("win") else "python")
        if not vpython or not vpython.exists():
            vpython = Path(sys.executable)
        ret = run_project_entry(vpython, project_root, entry, sys.argv[1:])
        sys.exit(ret)

    # Non-child mode: build launcher exe if not present, install deps otherwise
    script_dir = Path(__file__).resolve().parent
    entry = find_entrypoint(script_dir)  # entrypoint for the wrapper itself if needed
    # Locate or set project root as current working dir by default
    if not entry:
        logging.info("No local entrypoint for launcher; proceeding with dependency bootstrap only.")
    # Ensure a venv exists for packaging and running the project
    venv_dir = project_root / ".venv"
    python_exe = ensure_venv(venv_dir)
    # Install dependencies if a requirements file exists
    if not install_requirements(python_exe, project_root):
        logging.warning("Failed to install requirements; continuing may fail at runtime.")
    # Ensure PyInstaller is available for packaging
    if not ensure_pyinstaller(python_exe):
        logging.warning("Could not install PyInstaller; packaging will be unavailable.")
    # Build the launcher exe if missing (Windows only)
    dist_exe = project_root / "dist" / "CryptoFuturesLauncher.exe"
    is_windows = platform.system().lower().startswith("win")
    if not dist_exe.exists():
        if not is_windows:
            # Non-Windows environments cannot build a Windows executable; run entrypoint directly
            logging.warning("Non-Windows environment detected; skipping PyInstaller packaging and running entrypoint directly.")
            entry = find_entrypoint(project_root)
            if not entry:
                logging.error("No entrypoint found for direct execution in %s", project_root)
                sys.exit(1)
            ret = run_project_entry(python_exe, project_root, entry, sys.argv[1:])
            sys.exit(ret)
        print("Building Windows launcher exe...")
        if not build_executable(python_exe, project_root):
            logging.error("Failed to build the launcher exe.")
            # Fall back to running the project directly if possible
            entry = find_entrypoint(project_root)
            if entry:
                ret = run_project_entry(python_exe, project_root, entry, sys.argv[1:])
                sys.exit(ret)
            sys.exit(1)
        # After building, run the child-mode launcher to start the actual project
        child_env = os.environ.copy()
        child_env["CRYPTO_LAUNCHER_CHILD"] = "1"
        child_env["CRYPTO_PROJECT_ROOT"] = str(project_root)
        exe_to_run = dist_exe
        if not exe_to_run.exists():
            logging.error("Launcher exe not found after packaging: %s", exe_to_run)
            sys.exit(1)
        print("Launching packaged launcher: {}".format(exe_to_run))
        subprocess.run([str(exe_to_run)], env=child_env, check=False)
        sys.exit(0)
    else:
        # If the exe already exists, just run it (child mode will be activated)
        child_env = os.environ.copy()
        child_env["CRYPTO_LAUNCHER_CHILD"] = "1"
        child_env["CRYPTO_PROJECT_ROOT"] = str(project_root)
        print("Launching existing launcher: {}".format(dist_exe))
        subprocess.run([str(dist_exe)], env=child_env, check=False)
        sys.exit(0)

if __name__ == "__main__":
    main()
