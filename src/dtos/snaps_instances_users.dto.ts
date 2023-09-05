export interface CreateSnapInstanceUserDto {
  userId: number;
  snapInstanceId: number;
  snapShapePositionId: number;
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

export interface TakeSnapDto {
  key: string;
  userId: number;
}
