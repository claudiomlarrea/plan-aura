#!/bin/bash
# Actualización diaria: planillas oficiales + JSON/CSV que lee el sitio.
# Recomendado a las 14:00 (UTC-3). No interpola ni inventa días sin dato.
set -euo pipefail
cd "$(dirname "$0")"
python3 actualizar.py "$@"
python3 scripts/analisis_anual.py
