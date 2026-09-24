# Digiturno

Gestión de espera y notificación de pedidos y turnos para restaurantes, cafeterías, panaderías y tiendas.

> Digiturno no es el sistema que vende el producto. Es el sistema que sabe que el cliente está esperando y le avisa cuando ya puede recogerlo.

## Requisitos

- Node.js 20.9 o superior
- pnpm

## Puesta en marcha

```bash
pnpm install
cp .env.example .env
pnpm db:push
pnpm db:seed
pnpm dev
```

Abre http://localhost:3000.

`pnpm db:seed` crea el negocio **Café Demo** con estos usuarios (contraseña `digiturno123`):

| Usuario | Rol |
|---|---|
| admin@demo.co | Administrador |
| cajero@demo.co | Cajero |
| cocina@demo.co | Cocina |

El seed también imprime la URL de la pantalla pública y una API key de prueba. También puedes crear tu propio negocio desde `/signup`.

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` y `pnpm start` | Build y servidor de producción |
| `pnpm test` | Pruebas: dominio, API y aislamiento entre negocios |
| `pnpm lint` | Chequeo de tipos |
| `pnpm db:reset` | Borra la base local y vuelve a sembrarla |

## Pantallas

| Pantalla | Ruta | Roles |
|---|---|---|
| Dashboard | `/dashboard` | Administrador |
| Nuevo pedido | `/orders/new` | Administrador, Cajero |
| Cocina / estados | `/kitchen` | Todos |
| Historial | `/history` | Administrador, Cajero |
| Configuración | `/settings` | Administrador |
| Pantalla pública | `/business/{id}/display/{token}` | Pública (token) |
| Seguimiento QR | `/t/{token}` | Pública (token) |

## Notificaciones

- **SMS** (canal principal):
  - `SMS_PROVIDER=console` imprime los mensajes en la consola del servidor. Es la opción de desarrollo.
  - `SMS_PROVIDER=bird` los envía de verdad y requiere `SMS_API_KEY`, `BIRD_WORKSPACE_ID` y `BIRD_CHANNEL_ID`.
  - Para agregar otro proveedor, implementa `SmsProvider` en `src/domain/notifications/providers/sms.ts`.
- **Telegram** (opcional): configura `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` y `TELEGRAM_WEBHOOK_SECRET`, y registra el webhook:

  ```bash
  curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=$APP_URL/api/telegram/webhook&secret_token=$TELEGRAM_WEBHOOK_SECRET"
  ```

  En la página de seguimiento, el cliente ve el botón "Recibir el aviso también por Telegram".
- **WhatsApp**: integración futura. Ya existe la interfaz `WhatsAppProvider`.

## API

Ver [docs/API.md](docs/API.md). Resumen:

```
POST  /api/v1/orders        { external_order_id, customer: { phone, name }, status }
PATCH /api/v1/orders/{id}   { status: "READY" }   → notifica al cliente
```

## Producción

1. En `prisma/schema.prisma`, cambia `provider = "sqlite"` por `"postgresql"` y apunta `DATABASE_URL` a tu base.
2. Define `APP_URL` con tu dominio. Se usa en los links de seguimiento y en el QR.
3. Ejecuta `pnpm db:push` (o migraciones) y luego `pnpm build && pnpm start`.

Si corres más de una instancia, mueve el rate limiting (`src/lib/rateLimit.ts`) a Redis.

Arquitectura y decisiones: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
