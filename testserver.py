# ═══════════════════════════════════════════════════════════════
#  StoplichtIQ — testserver.py
#  © 2026 StoplichtIQ — Y. Lemaalem
#
#  De testserver voor de toetsen (alleen 127.0.0.1). Hetzelfde als
#  python -m http.server, maar met een wachtrij van 128 in plaats van 5, en
#  met de lijst van de toetsen op /__toetsen.json (voor test_merktekens).
#
#  WAAROM. Een ronde draait veel ritten in iframes, en elke rit laadt de app
#  en een testscript. http.server accepteert maar 5 wachtende verbindingen
#  (request_queue_size); daarboven ging een verzoek verloren en faalde de toets
#  met een gewone fout (NB15b en NB16b, SN5). Gemeten op Windows (STAP 0 van 10 okt):
#  met wachtrij 5 mislukten 14 en 32 van de 1200 gelijktijdige verzoeken, met
#  128 geen van de 2400.
#
#  DRAAIEN
#    python testserver.py [poort]     (in de repo-map; standaard 8765)
#    open http://127.0.0.1:8765/index.html
# ═══════════════════════════════════════════════════════════════
import functools, http.server, json, os, sys

MAP = os.path.dirname(os.path.abspath(__file__))


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.partition('?')[0] == '/__toetsen.json':
            namen = sorted(n for n in os.listdir(MAP) if n.startswith('test_') and n.endswith('.js'))
            data = json.dumps(namen).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()


if __name__ == '__main__':
    poort = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = functools.partial(Handler, directory=MAP)
    print(f'http://127.0.0.1:{poort}/index.html  (wachtrij {Server.request_queue_size})', flush=True)
    Server(('127.0.0.1', poort), handler).serve_forever()
