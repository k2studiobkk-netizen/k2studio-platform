export const dashboardDepartments = ["print_cut", "pack", "sale"] as const;
export type DashboardDepartment = (typeof dashboardDepartments)[number];

export type ProductionDashboardJob = {
  id: number;
  orderId: number;
  orderNumber: string;
  publicToken: string;
  productName: string;
  productCategory: string;
  quantity: number;
  deliveryDate: string;
  productionDate: string;
  priority: string;
  rushStatus: string;
  dashboardNote: string;
  queueRank: number;
  status: string;
  imageUrl: string;
};

export type SaleCapacityDay = {
  date: string;
  usedMinutes: number;
  capacityMinutes: number;
  percent: number;
  jobCount: number;
  state: "available" | "busy" | "nearly_full" | "full";
};

export type ProductionDashboardPayload = {
  department: DashboardDepartment;
  date: string;
  jobs: ProductionDashboardJob[];
  saleCapacity: SaleCapacityDay[];
  recommendedDate: string;
};

export type TodayDashboardJob = ProductionDashboardJob & {
  customerName: string;
};

export type PaymentDueAlert = {
  orderId: number;
  orderNumber: string;
  customerName: string;
  deliveryDate: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
};

export type TodayDashboardPayload = {
  date: string;
  jobs: TodayDashboardJob[];
  paymentAlerts: PaymentDueAlert[];
};
