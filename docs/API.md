# Digiturno API v1

La API permite que un sistema externo (WhatsOrder, POS, facturación, etc.) registre pedidos y los marque como listos. Digiturno **no** recibe productos, precios ni pagos. Solo recibe el número del pedido y el celular del cliente.

## Autenticación

Crea una API key en **Configuración → Integraciones**. La key se muestra una sola vez y Digiturno guarda únicamente su hash SHA-256.

```
Authorization: Bearer dt_live_xxxxxxxx
```

Cada key pertenece a un negocio y tiene un **origen** (`API`, `WHATSORDER`, `POS`, `BILLING`). Los pedidos creados con esa key quedan con ese origen. Una key nunca puede ver ni modificar pedidos de otro negocio.

Límite: 300 solicitudes por minuto por key.

## POST /api/v1/orders

```json
{
  "external_order_id": "583",
  "customer": { "phone": "+573155551234", "name": "Juan" },
  "status": "PREPARING",
  "consent": { "notification": true, "marketing": false }
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `external_order_id` | sí, o `order_number` | ID en el sistema origen. **Idempotente**: si se repite con el mismo origen, devuelve el pedido existente (200). |
| `order_number` | no | Número visible. Por defecto es `external_order_id`. |
| `customer.phone` | sí, si el negocio exige celular | Cualquier formato. Se normaliza a E.164 con el país del negocio. |
| `customer.name` | no | |
| `status` | no | `NEW` (defecto), `PREPARING` o `READY`. Si llega `READY`, se notifica de inmediato. |
| `source` | no | Por defecto es el origen de la key. |
| `notify` | no | `true` por defecto. |
| `consent.notification` | no | `true` por defecto: el sistema origen es responsable de haberlo obtenido. |
| `consent.marketing` | no | `false` por defecto. Es independiente del consentimiento de notificaciones. |

Respuestas: `201` si se crea, `200` si ya existía, `401` sin key válida, `409` si ya hay un pedido activo con ese número, `422` si hay errores de validación. Se rechazan los campos desconocidos, por ejemplo precios.

## PATCH /api/v1/orders/{id}

```json
{ "status": "READY" }
```

Estados: `PREPARING`, `READY`, `DELIVERED`, `CANCELLED`. Al pasar a `READY`, Digiturno registra `ready_at`, envía la notificación y el número aparece en la pantalla pública.

Transiciones válidas: `NEW → PREPARING | READY`, `PREPARING → READY`, `READY → DELIVERED`, y cualquier estado activo → `CANCELLED`. Cualquier otra devuelve `409`.

`{id}` es el `id` de Digiturno. Para usar el ID del sistema origen, agrega `?lookup=external`:

```
PATCH /api/v1/orders/583?lookup=external
```

## GET /api/v1/orders/{id}

Devuelve el pedido. También acepta `?lookup=external`.

## Formato de respuesta

```json
{
  "data": {
    "id": "cm…",
    "order_number": "583",
    "external_order_id": "583",
    "source": "WHATSORDER",
    "status": "READY",
    "tracking_url": "https://…/t/<token>",
    "customer": { "phone": "***1234", "name": "Juan" },
    "notification": { "channel": "SMS", "status": "SENT", "error": null, "sent_at": "…" },
    "created_at": "…", "preparing_at": "…", "ready_at": "…", "delivered_at": null, "cancelled_at": null
  }
}
```

Errores: `{ "error": { "code": "VALIDATION", "message": "…" } }`.
