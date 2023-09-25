export interface SnapInstance {
  id: number;
  userId: number;

  instanceKey: string;

  timerStarted: boolean;
  timerSeconds: number;
  timerStartAt: Date | null;

  timerPublishSeconds: number;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  unarchived: boolean;
}
