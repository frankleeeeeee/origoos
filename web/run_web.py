from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os


def run():
    web_dir = Path(__file__).parent.resolve()
    os.chdir(web_dir)
    server = ThreadingHTTPServer(("0.0.0.0", 8501), SimpleHTTPRequestHandler)
    print("静态前端已启动: http://localhost:8501/index.html")
    server.serve_forever()


if __name__ == "__main__":
    run()
