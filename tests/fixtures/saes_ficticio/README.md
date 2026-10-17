# SAES simulado

Fixtures sintéticos, sin datos ni capturas de alumnado. El kárdex y el estado
reutilizan los casos genéricos ficticios de `tests/fixtures/`; ocupabilidad
reutiliza `ocupabilidad_ficticio.html` con las carreras y planes del simulador.
Las páginas sin información contienen solo la identidad ficticia mínima.

Se sustituyó la referencia a `upiita/2026-10-14`, carpeta ausente del repositorio.
Estos casos verifican el contrato de parsers y postbacks; no prueban fidelidad
visual ni representan una captura real del SAES.

Tras un cambio intencional del parser:
`python tools/saes_estructuras.py --actualizar` regenera el contrato revisable.
