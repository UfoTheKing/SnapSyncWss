export interface SnapInstanceUser {
  id: number;
  snapInstanceId: number;
  snapShapePositionId: number;
  userId: number;
  isOwner: boolean;
  imageKey: string | null;

  isJoined: boolean;
  joinedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  unarchived: boolean;
}
