// src/app/modules/supplier/supplier.types.ts
export type CreateSupplierInput = {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  category: string;
  criticality: 'LOW' | 'MEDIUM' | 'HIGH';
  contractStartDate: string;
  contractEndDate: string;
  contractDocument?: string;
  documentType?: string;
};

export type BulkImportSuppliersInput = {
  suppliers: Omit<CreateSupplierInput, 'contractDocument' | 'documentType'>[];
};

export type BulkImportResult = {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    supplier: CreateSupplierInput;
    success: boolean;
    message?: string;
    invitationSent?: boolean;
  }>;
};