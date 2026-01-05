export interface Alert {
  id: string;
  severity: "low" | "medium" | "high";
  message: string;
  status?: "OPEN" | "CLOSED" | "ACKNOWLEDGED";
  timestamp?: number; // gunakan Unix timestamp
  parameter?: string;
  value?: number;
}
