"""Compatibilidad: la compilación de Horarios ahora produce SATE (`--solo-datos`: solo los datos)."""
from build_sate import *

if __name__ == "__main__":
    import sys
    main(solo_datos="--solo-datos" in sys.argv)
