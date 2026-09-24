export const ROLES = ["ADMIN", "CASHIER", "KITCHEN"] as const;
export type Role = (typeof ROLES)[number];

export const ORDER_STATUSES = ["NEW", "PREPARING", "READY", "DELIVERED", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ACTIVE_STATUSES: OrderStatus[] = ["NEW", "PREPARING", "READY"];

export const ORDER_SOURCES = ["MANUAL", "WHATSORDER", "POS", "BILLING", "API"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const CHANNELS = ["SMS", "TELEGRAM", "WHATSAPP"] as const;
export type Channel = (typeof CHANNELS)[number];

export const NOTIFICATION_STATUSES = ["PENDING", "SENT", "DELIVERED", "FAILED"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "Nuevo",
  PREPARING: "Preparando",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  CASHIER: "Cajero",
  KITCHEN: "Cocina",
};

export const SOURCE_LABEL: Record<OrderSource, string> = {
  MANUAL: "Manual",
  WHATSORDER: "WhatsOrder",
  POS: "POS",
  BILLING: "Facturación",
  API: "API",
};
