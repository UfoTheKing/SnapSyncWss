export interface SnapInstance {
  id: number;
  userId: number;
  snapInstanceShapeId: number;
  hashedKey: string;

  timerStarted: boolean;
  timerDurationMinutes: number;
  timerDurationSeconds: number;

  imageKey: string | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  unarchived: boolean;
}
