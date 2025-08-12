import os, sys, subprocess, time, webbrowser
from pathlib import Path

# Figure out our app root whether running as .py or frozen .exe
if getattr(sys, "frozen", False):
    ROOT = Path(sys.executable).resolve().parent
else:
    ROOT = Path(__file__).resolve().parent

SERVER = ROOT / "server"
CLIENT = ROOT / "client"
URL = os.environ.get("APP_URL", "http://127.0.0.1:5173")

def spawn(where: Path, cmd: str):
    # shell=True is fine on Windows for npm scripts
    return subprocess.Popen(cmd, cwd=str(where), shell=True)

def main():
    # Start backend first
    srv = spawn(SERVER, "npm run dev")
    time.sleep(2)
    # Then frontend
    cli = spawn(CLIENT, "npm run dev")
    # Give Vite a moment, then open browser
    time.sleep(5)
    try:
        webbrowser.open(URL)
    except Exception:
        pass

    # Keep this process alive while children run
    try:
        srv.wait()
        cli.wait()
    except KeyboardInterrupt:
        pass
    finally:
        for p in (srv, cli):
            if p and p.poll() is None:
                p.terminate()
                try:
                    p.wait(timeout=5)
                except Exception:
                    p.kill()

if __name__ == "__main__":
    main()
