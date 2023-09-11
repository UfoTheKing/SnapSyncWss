export interface SnapShapePosition {
  id: number;
  snapShapeId: number;
  name: string;

  ownerPosition: boolean;

  width: number;
  height: number;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  unarchived: boolean;
}
