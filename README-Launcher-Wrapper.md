Launcher Wrapper (Windows-friendly)

- Usage: python launcher_wrapper.py
- Behavior:
  - If dist/CryptoFuturesLauncher.exe exists, the wrapper executes it.
  - If not, it falls back to running launcher.py directly, logging to
    launcher_wrapper.log for diagnostics.
- This helps diagnose and recover when the PyInstaller packaging step fails or
  isn’t executed in your environment.

