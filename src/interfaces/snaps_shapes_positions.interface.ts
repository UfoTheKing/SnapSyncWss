export interface SnapShapePosition {
  id: number;
  snapShapeId: number;
  name: string;

  ownerPosition: boolean;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  unarchived: boolean;
}
