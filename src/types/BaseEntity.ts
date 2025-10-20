export interface BaseEntity {
  createdAt: Date;  
  updatedAt: Date; 
}

export interface PaginatedData {
  page: number;
  totalPages: number;
  totalItems: number;
  items: any[];
}