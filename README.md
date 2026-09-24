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

`pnpm db:seed` crea el negocio **Café Demo** (plan Básico) con estos usuarios. Todos usan la contraseña `digiturno123`:

| Usuario | Rol | Entra por |
|---|---|---|
| admin@demo.co | Administrador del negocio | `/login` |
| cajero@demo.co | Cajero | `/login` |
| cocina@demo.co | Cocina | `/login` |
| superadmin@demo.co | Superadmin de la plataforma | `/admin/login` |

El seed también imprime la URL de la pantalla pública y una API key de prueba. También puedes crear tu propio negocio desde `/signup`.

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` y `pnpm start` | Build y servidor de producción |
| `pnpm test` | Pruebas: dominio, API y aislamiento entre negocios |
| `pnpm lint` | Chequeo de tipos |
| `pnpm db:reset` | Borra la base local y vuelve a sembrarla |
| `pnpm admin:create correo "Nombre"` | Crea un superadmin (pide la contraseña, mínimo 12 caracteres) |

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

## Modelo SaaS y créditos SMS

La plataforma tiene **una sola cuenta de SMS**, configurada por ti en las variables de entorno. Los negocios nunca ven ni configuran el proveedor: consumen créditos.

- **Plan:** cada negocio tiene un plan con SMS incluidos por mes. Se asignan el día 1, en la zona horaria del negocio, y los que no se usan vencen al terminar el mes.
- **Créditos adicionales:** son recargas que aprueba el superadmin y no vencen.
- **Consumo:** cada SMS descuenta 1 crédito, primero de los incluidos y luego de los adicionales. Si el proveedor falla, el crédito se devuelve. Telegram no consume créditos.
- **Sin saldo:** el pedido y la pantalla pública siguen funcionando; solo la notificación queda como fallida ("Sin créditos SMS").
- **Recargas:** el administrador del negocio pide una en Configuración → Plan y créditos. El superadmin la aprueba en `/admin/requests` cuando recibe el pago; el pago se gestiona fuera de la app. También puede recargar o ajustar créditos directamente desde la ficha del negocio.
- **Panel `/admin`** (superadmin):
  - negocios, con su consumo del mes y su saldo
  - cambio de plan
  - suspender y reactivar un negocio: suspendido no puede entrar, usar la API ni mostrar la pantalla pública
  - planes
  - solicitudes de recarga
  - libro de movimientos para facturar

## Notificaciones

- **SMS** (canal principal): una sola cuenta para toda la plataforma, configurada en `.env` o en las variables del hosting.
  - `SMS_PROVIDER=console` imprime los mensajes en la consola del servidor. Es la opción de desarrollo.
  - `SMS_PROVIDER=bird` los envía de verdad y requiere tres datos de tu cuenta de Bird: `SMS_API_KEY` (Access Key), `BIRD_WORKSPACE_ID` y `BIRD_CHANNEL_ID` (el canal SMS). Hay que reiniciar el servidor después de cambiarlos.
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
4. Crea tu superadmin con `pnpm admin:create tu@correo.com "Tu nombre"`. No uses el del seed en producción.
5. Entra en `/admin/plans` y define tus planes. Marca uno como "por defecto": es el que reciben los negocios nuevos al registrarse.

Si corres más de una instancia, mueve el rate limiting (`src/lib/rateLimit.ts`) a Redis.

Arquitectura y decisiones: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
