export interface SnapInstanceUser {
  id: number;
  userId: number;
  snapInstanceId: number;
  snapShapePositionId: number;
  locationId: number | null;

  isOwner: boolean;
  isJoined: boolean;
  joinedAt: Date | null;

  cdlPublicId: string | null;
  snappedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  unarchived: boolean;
}
