# Digital Twins Soledad

Gemelo digital interactivo de la PTAP **AP01 La Soledad** (La Buitrera, Cali).
Desarrollado para **UAESP Cali** — Contrato 4182.010.26.1.507-2023 · Consorcio AQUATECH.

## Características

- Diagrama de proceso SVG animado con 5 etapas clicables (Captación → Distribución)
- 23 instrumentos del P&ID Rev.00 con lecturas simuladas en tiempo real
- Panel de detalle por instrumento: TAG, rango, protocolo, estado
- Ticker de métricas clave en el header
- Diseño dark cyberpunk — sin base de datos, sin autenticación

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14 App Router |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS + inline styles |
| Fuentes | Orbitron · IBM Plex Mono |
| Deploy | Netlify (sitio estático) |

## Comandos

```bash
npm run dev      # Desarrollo — http://localhost:3000
npm run build    # Build de producción
npm run start    # Servidor de producción
```

## Datos técnicos

- **Código AQUATECH:** AP01
- **Fuentes hídricas:** Río Lili · Río FCYS
- **Tipo de tratamiento:** FIME
- **Instrumentos P&ID:** 23 (Rev.00 — 29/04/2024)
- **Supervisor UAESP:** Giovanny Guevara Duque

---

> UAESP Cali · 2026
