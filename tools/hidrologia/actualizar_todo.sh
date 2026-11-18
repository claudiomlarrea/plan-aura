#!/bin/bash
# Actualización diaria: planillas oficiales + JSON/CSV que lee el sitio.
# Recomendado a las 14:00 (UTC-3). No interpola ni inventa días sin dato.
set -euo pipefail
cd "$(dirname "$0")"
python3 actualizar.py "$@"
python3 scripts/analisis_anual.py
python3 scripts/balance_caracoles.py
# El pronóstico usa la serie recién escrita y Open-Meteo. Si el clima no
# responde, se conserva el JSON anterior y la serie oficial igual se publica.
python3 scripts/pronostico_cierre_mes.py || {
  echo "AVISO: no se pudo regenerar el pronóstico de cierre de mes. Se conserva el JSON anterior." >&2
}
