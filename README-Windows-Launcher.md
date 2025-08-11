Windows distribution guide for Crypto-Futures

- Use the Python launcher approach for a single-file exe:
  - Run `python build_win_exe.py` to create `CryptoFuturesLauncher.exe` in the `dist/` directory.
- The launcher automatically looks for common entrypoint files (main.py, app.py, run.py, start.py).
- Ensure Python and PyInstaller are installed in the build environment.
- Test by running the generated exe from a Windows command prompt.

