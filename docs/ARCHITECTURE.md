# Arquitectura y decisiones

## Principios

1. **Digiturno no vende.** Solo sabe que un cliente está esperando y le avisa cuando puede recoger su pedido. No hay productos, precios, pagos ni inventario.
2. **El teléfono E.164 es la identidad común** del cliente en el ecosistema (Digiturno, WhatsOrder, Pass2One, Domi911).

## Stack

| Pieza | Elección | Motivo |
|---|---|---|
| App | Next.js 15 (App Router) + TypeScript | Frontend y backend en un solo despliegue. |
| BD | Prisma + SQLite (dev) | Cero configuración local. Para producción se cambia `provider` a `postgresql`. |
| Estilos | Tailwind CSS v4 | Diseño responsive rápido. |
| Validación | zod | En todas las entradas: formularios, API y parámetros. |
| Teléfonos | libphonenumber-js | Normalización E.164 fiable. |
| Tests | Vitest | Pruebas de dominio y API contra una base SQLite de prueba. |

## Capas

```
src/
  app/                  UI (pages) + route handlers (API)
    (auth)/             login, signup
    (app)/              dashboard, orders/new, kitchen, history, settings
    business/[id]/display/[token]   pantalla pública (sin login)
    t/[token]           seguimiento QR (sin login)
    api/v1/             API externa (API keys)
    api/app/            JSON interno para la UI (sesión)
    api/public/         JSON de pantallas públicas (tokens)
    api/telegram/       webhook del bot
  domain/               lógica de negocio, sin dependencia de Next.js
    orders/             OrderService, transiciones, consultas
    customers/          cliente por (negocio, teléfono) + consentimientos
    notifications/      NotificationService → SmsProvider / TelegramProvider / WhatsAppProvider
    ecosystem/          tipos y catálogo de integraciones (preparación)
    events.ts           bus de eventos (punto de extensión para integraciones)
  lib/                  auth, db, teléfono, tiempo, rate limit, auditoría
```

## Decisiones

- **Enums como `String`.** Así el mismo esquema funciona en SQLite y PostgreSQL. Los valores válidos están en `src/lib/constants.ts` y se validan con zod.
- **Sesiones propias.** Se guarda un token aleatorio en una cookie httpOnly y en BD solo su SHA-256. Las contraseñas usan bcrypt (12 rondas). Las sesiones duran 14 días.
- **Aislamiento por negocio.** Todas las consultas filtran por el `businessId` de la sesión o de la API key, nunca por uno que venga del cliente. Hay tests que lo verifican.
- **Tiempo real por polling.** Cocina se actualiza cada 4 s, la pantalla pública cada 3 s y el seguimiento cada 5 s. Es robusto en TVs y en hosting serverless. Se puede cambiar a SSE o WebSockets sin tocar el dominio.
- **Numeración.** Hay dos modos:
  - `MANUAL`: el cajero escribe el número del POS o ticket.
  - `AUTO`: contador por negocio, con reinicio diario opcional en la zona horaria del negocio.

  No puede haber dos pedidos activos con el mismo número.
- **Consentimientos.** El de notificaciones y el de marketing se guardan por separado, con fecha y origen (`MANUAL:<userId>` o `API:<keyId>`). Un "no" en un pedido posterior no revoca un "sí" anterior; revocar es una acción explícita. Cada otorgamiento queda en `AuditLog` como evidencia.
- **Selección de canal.** El orden es:
  1. Telegram, si el cliente vinculó el bot y el negocio lo activó.
  2. SMS.
  3. WhatsApp, en el futuro.

  Si un canal falla, se prueba el siguiente. Un fallo de notificación nunca revierte el cambio de estado; queda como `FAILED` con el error.
- **Idempotencia de la API** por (negocio, origen, `external_order_id`), para que los reintentos de integraciones no dupliquen pedidos.
- **Rate limiting en memoria.** Sirve para una sola instancia. Con varias réplicas hay que moverlo a Redis.
- **Logo por URL** (https). No se suben archivos en el MVP.

## Integración futura con WhatsOrder

WhatsOrder crea una API key con origen `WHATSORDER` y llama `POST /api/v1/orders` con `external_order_id` y el teléfono. Cuando su pedido esté listo, llama `PATCH /api/v1/orders/{id}?lookup=external` con `{"status":"READY"}` y Digiturno notifica.

Para avisar en sentido contrario (Digiturno → otras apps), hay que suscribirse a `order.status_changed` en `src/domain/events.ts` y enviar un webhook.
