export type NotificationAudience = {
  userId?: string;
  driverId?: string;
  deviceIds?: string[];
};

export type NotificationJobType =
  | "ORDER_ASSIGNMENT"
  | "ORDER_STATUS"
  | "ALARM_REMINDER"
  | "CUSTOM";

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: "high" | "normal";
}

export interface NotificationJob {
  type: NotificationJobType;
  audience: NotificationAudience;
  payload: NotificationPayload;
  metadata?: {
    orderId?: string;
    driverId?: string;
    userId?: string;
    alarmId?: string;
    eventId?: string;
  };
}
