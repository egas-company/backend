export enum UserRole {
  CLIENT = "CLIENT",
  DRIVER = "DRIVER",
  ADMIN = "ADMIN",
}

export interface UserPayload {
  id: string;
  role: UserRole;
  phoneNumber: string;
  userId: string;
}
