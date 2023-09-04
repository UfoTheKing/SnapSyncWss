export interface SnapInstanceShapePosition {
  id: number;
  snapInstanceShapeId: number;
  name: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  unarchived: boolean;

  ownerPosition: boolean;
}
