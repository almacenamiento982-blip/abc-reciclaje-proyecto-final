# -*- coding: utf-8 -*-
"""
Simulador de subidas del proyecto final.

Reproduce exactamente el flujo del navegador (vía directa):
  1. POST iniciar  -> el backend abre la sesión reanudable en Drive y devuelve su URL
  2. PUT bloques de 16 MB directamente a Google (con cabecera Origin del sitio)
  3. POST finalizar -> el backend verifica el archivo y marca la fila como Recibido

Uso:
  python simular_subidas.py <video.mp4> <n> [--paralelo K] [--mbps X] [--origen URL]
    --paralelo K  cuántas subidas simultáneas (por defecto 1)
    --mbps X      limita la velocidad de cada subida (simula un celular en 4G, p. ej. 12)
    --borrar CLAVE  elimina las entregas creadas al terminar (requiere la clave docente)

Las entregas se identifican con documento SIM-... y nombre "Simulación ...".
"""
import sys, os, json, time, urllib.request, urllib.error, threading, argparse, statistics

URL = "https://script.google.com/macros/s/AKfycby-epPMyQ5z3oieq80_UhuteFj3S4GCznR-YVtVqtBnf9GJo983GwL2hxbrrsMrPwPJOg/exec"
BLOQUE = 16 * 1024 * 1024


def post(datos, timeout=120):
    req = urllib.request.Request(URL, data=json.dumps(datos).encode(), headers={"Content-Type": "text/plain;charset=UTF-8"}, method="POST")
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read().decode())


class Limitador:
    """Limita bytes/segundo escribiendo en trozos pequeños con pausas."""
    def __init__(self, mbps):
        self.bps = mbps * 1_000_000 / 8 if mbps else 0

    def dormir(self, enviados, t0):
        if not self.bps:
            return
        esperado = enviados / self.bps
        trans = time.time() - t0
        if esperado > trans:
            time.sleep(esperado - trans)


class CuerpoLimitado:
    """Objeto tipo archivo que urllib lee por trozos; aplica el limitador."""
    def __init__(self, datos, lim):
        self.datos, self.pos, self.lim, self.t0 = datos, 0, lim, time.time()

    def read(self, n=-1):
        if self.pos >= len(self.datos):
            return b""
        n = 256 * 1024 if n < 0 else min(n, 256 * 1024)
        trozo = self.datos[self.pos:self.pos + n]
        self.pos += len(trozo)
        self.lim.dormir(self.pos, self.t0)
        return trozo

    def __len__(self):
        return len(self.datos)


def subir(ruta, idx, origen, mbps, resultados):
    tam = os.path.getsize(ruta)
    nombre = os.path.basename(ruta)
    t_ini = time.time()
    tiempos = {}
    try:
        t = time.time()
        r = post({"action": "iniciar", "origen": origen,
                  "meta": {"nombre": "Simulación %02d" % idx, "documento": "SIM%04d" % idx, "correo": "sim%02d@prueba.com" % idx,
                           "zona": "Zona de Bogotá y Cundinamarca", "grupo": "Lunes 10:00-11:30am (G-4848)", "titulo": "Simulación de carga", "autoriza": "SI"},
                  "archivo": {"nombre": nombre, "tipo": "video/mp4", "tamano": tam}})
        tiempos["iniciar"] = time.time() - t
        if not r.get("ok") or not r.get("sesionUrl"):
            raise RuntimeError("iniciar falló: %s" % r)
        sesion, upload_id, radicado = r["sesionUrl"], r["uploadId"], r["radicado"]
        lim = Limitador(mbps)
        archivo_id = ""
        t = time.time()
        with open(ruta, "rb") as fh:
            pos = 0
            while pos < tam:
                datos = fh.read(BLOQUE)
                fin = pos + len(datos) - 1
                # Igual que el navegador: hasta 3 reintentos por bloque ante fallos de red
                intento = 0
                while True:
                    cuerpo = CuerpoLimitado(datos, lim)
                    req = urllib.request.Request(sesion, data=cuerpo, method="PUT",
                                                 headers={"Origin": origen, "Content-Type": "video/mp4",
                                                          "Content-Range": "bytes %d-%d/%d" % (pos, fin, tam),
                                                          "Content-Length": str(len(datos))})
                    try:
                        resp = urllib.request.urlopen(req, timeout=120)
                        codigo = resp.status
                        cuerpo_resp = resp.read().decode()
                        break
                    except urllib.error.HTTPError as e:
                        codigo = e.code
                        cuerpo_resp = e.read().decode()
                        break
                    except Exception as e:  # red / SSL / tiempo agotado
                        intento += 1
                        if intento > 3:
                            raise
                        print("  #%02d reintento %d del bloque %d (%s)" % (idx, intento, pos // BLOQUE, e), flush=True)
                        time.sleep(2 * intento)
                        est = post({"action": "estado_subida", "uploadId": upload_id})
                        if est.get("archivoId"):
                            archivo_id, pos, datos = est["archivoId"], tam, b""
                            break
                        if est.get("recibido", pos) != pos:
                            fh.seek(est["recibido"]); pos = est["recibido"]; datos = fh.read(BLOQUE); fin = pos + len(datos) - 1
                if not datos:
                    break
                if codigo in (200, 201):
                    archivo_id = json.loads(cuerpo_resp).get("id", "")
                elif codigo != 308:
                    raise RuntimeError("Drive respondió %s en el bloque %d" % (codigo, pos // BLOQUE))
                pos += len(datos)
        tiempos["subida"] = time.time() - t
        t = time.time()
        f = post({"action": "finalizar", "uploadId": upload_id, "archivoId": archivo_id})
        tiempos["finalizar"] = time.time() - t
        if not f.get("ok"):
            raise RuntimeError("finalizar falló: %s" % f)
        total = time.time() - t_ini
        resultados.append({"idx": idx, "ok": True, "radicado": radicado, "total": total, "mbps": tam * 8 / tiempos["subida"] / 1e6, **tiempos})
        print("  #%02d %s  total %5.1f s  (iniciar %.1f s, subida %.1f s a %.1f Mbps, finalizar %.1f s)" % (
            idx, radicado, total, tiempos["iniciar"], tiempos["subida"], tam * 8 / tiempos["subida"] / 1e6, tiempos["finalizar"]), flush=True)
    except Exception as e:
        resultados.append({"idx": idx, "ok": False, "error": str(e), "total": time.time() - t_ini})
        print("  #%02d ERROR %s" % (idx, e), flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("n", type=int)
    ap.add_argument("--paralelo", type=int, default=1)
    ap.add_argument("--mbps", type=float, default=0)
    ap.add_argument("--origen", default="https://abc-reciclaje-proyecto-final.onrender.com")
    ap.add_argument("--borrar", default="")
    a = ap.parse_args()
    tam_mb = os.path.getsize(a.video) / 1048576
    print("Video: %s (%.1f MB) · %d subidas · %d en paralelo · límite %s" % (
        os.path.basename(a.video), tam_mb, a.n, a.paralelo, ("%.0f Mbps" % a.mbps) if a.mbps else "sin límite"))
    resultados = []
    t0 = time.time()
    pendientes = list(range(1, a.n + 1))
    while pendientes:
        lote = pendientes[:a.paralelo]
        pendientes = pendientes[a.paralelo:]
        hilos = [threading.Thread(target=subir, args=(a.video, i, a.origen, a.mbps, resultados)) for i in lote]
        for h in hilos: h.start()
        for h in hilos: h.join()
    ok = [r for r in resultados if r["ok"]]
    print("\nResumen: %d/%d correctas en %.0f s" % (len(ok), a.n, time.time() - t0))
    if ok:
        tot = [r["total"] for r in ok]
        print("  tiempo por video: min %.1f s · mediana %.1f s · max %.1f s" % (min(tot), statistics.median(tot), max(tot)))
        print("  velocidad efectiva: mediana %.1f Mbps" % statistics.median([r["mbps"] for r in ok]))
        print("  backend (iniciar+finalizar): mediana %.1f s" % statistics.median([r["iniciar"] + r["finalizar"] for r in ok]))
    if a.borrar:
        for r in ok:
            try:
                post({"action": "eliminar", "clave": a.borrar, "radicado": r["radicado"]})
            except Exception as e:
                print("  no se pudo borrar", r["radicado"], e)
        print("  entregas de simulación eliminadas (videos en la papelera de Drive)")


if __name__ == "__main__":
    main()
