export interface CreateSnapInstanceUserDto {
  userId: number;
  snapInstanceId: number;
  snapInstanceShapePositionId: number;
  isOwner: boolean;
  isJoined?: boolean;
  joinedAt?: Date;
}

export interface JoinUserToSnapInstanceDto {
  userId: number;
  key: string;
}

export interface LeaveUserToSnapInstanceDto {
  userId: number;
  key: string;
}
